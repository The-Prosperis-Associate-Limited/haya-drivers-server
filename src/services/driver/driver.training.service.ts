import type { $Enums } from "../../generated/prisma/client";
import { CertificationRepository } from "../../repositories/training/certification.repository";
import { CourseRepository } from "../../repositories/training/course.repository";
import { EnrollmentRepository } from "../../repositories/training/enrollment.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { TrustScoreService } from "../shared/trustScore.service";
import type { ModuleProgressInput } from "../../utils/types/trainingValidatorSchema";

const { CLIENT_URL } = process.env;

export class DriverTrainingService {
  private courseRepo = new CourseRepository();
  private enrollmentRepo = new EnrollmentRepository();
  private certificationRepo = new CertificationRepository();
  private userRepo = new UserRepository();
  private trustScoreService = new TrustScoreService();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();

  async listCourses(query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { courses, total } = await this.courseRepo.findPublished({ ...pagination, search: query.search as string | undefined });

    return paginate(courses, total, pagination);
  }

  async getCourse(userId: string, slug: string) {
    const course = await this.courseRepo.findBySlug(slug);

    if (!course || course.status !== "PUBLISHED") throw new NotFoundError("Course not found");

    const enrollment = await this.enrollmentRepo.findForUserAndCourse(userId, course.id);

    return { ...course, enrollment };
  }

  async enroll(userId: string, slug: string) {
    const course = await this.courseRepo.findBySlug(slug);

    if (!course || course.status !== "PUBLISHED") throw new NotFoundError("Course not found");

    return this.enrollmentRepo.ensure(userId, course.id);
  }

  async listEnrollments(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { enrollments, total } = await this.enrollmentRepo.findForUser(userId, { ...pagination, status: query.status as $Enums.EnrollmentStatus | undefined });

    return paginate(enrollments, total, pagination);
  }

  /*
    Progress is recomputed from the module rows rather than incremented, so
    replaying the same module twice cannot push a driver past 100% or hand them
    a second certificate.
  */
  async recordModuleProgress(userId: string, slug: string, moduleId: string, data: ModuleProgressInput) {
    const course = await this.courseRepo.findBySlug(slug);

    if (!course) throw new NotFoundError("Course not found");
    if (!course.modules.some(module => module.id === moduleId)) throw new BadRequestError("That module is not part of this course");

    const enrollment = await this.enrollmentRepo.ensure(userId, course.id);

    await this.enrollmentRepo.upsertModuleProgress(enrollment.id, moduleId, {
      completed_at: data.completed ? new Date() : null,
      minutes_spent: data.minutes_spent,
    });

    const completedModules = await this.enrollmentRepo.countCompletedModules(enrollment.id);
    const progress = course.modules.length ? Math.round((completedModules / course.modules.length) * 100) : 0;
    const isComplete = progress >= 100;

    await this.enrollmentRepo.update(enrollment.id, {
      progress,
      status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      minutes_spent: { increment: data.minutes_spent },
      completed_at: isComplete ? new Date() : null,
    });

    if (isComplete) await this.issueCertification(userId, course);

    return { progress, completed: isComplete };
  }

  async listCertifications(userId: string) {
    return this.certificationRepo.findForUser(userId);
  }

  async stats(userId: string) {
    const [certifications, inProgress, minutes, breakdown] = await Promise.all([
      this.certificationRepo.countForUser(userId),
      this.enrollmentRepo.countForUser(userId, "IN_PROGRESS"),
      this.enrollmentRepo.sumMinutesForUser(userId),
      this.trustScoreService.breakdown(userId),
    ]);

    return {
      certifications_earned: certifications,
      modules_in_progress: inProgress,
      trust_score_boost: breakdown.training,
      minutes_invested: minutes,
    };
  }

  private async issueCertification(userId: string, course: NonNullable<Awaited<ReturnType<CourseRepository["findBySlug"]>>>) {
    const existing = await this.certificationRepo.findForUserAndCourse(userId, course.id);

    if (existing) return existing;

    const expires_at = course.certificate_validity_months
      ? new Date(new Date().setMonth(new Date().getMonth() + course.certificate_validity_months))
      : null;

    const certification = await this.certificationRepo.create({
      userId,
      courseId: course.id,
      reference: generateReference("CERT"),
      expires_at,
    });

    await this.trustScoreService.recompute(userId);

    await this.notificationService.notify({
      recipientId: userId,
      type: "TRAINING",
      title: "Certificate earned",
      message: `You completed ${course.title}. Your certificate is ready to download.`,
      actionUrl: "/dashboard/training/certifications",
    });

    await this.activityService.record(userId, "CERTIFICATION_ISSUED", `Certified: ${course.title}`);

    const user = await this.userRepo.findById(userId, { email: true, first_name: true });

    await queueEmail(JOB_KEY.CERTIFICATION_ISSUED, {
      email: user?.email as string,
      first_name: (user?.first_name as string) ?? "there",
      courseTitle: course.title,
      trustScoreReward: course.trust_score_reward,
      reference: certification.reference,
      baseUrl: CLIENT_URL as string,
    });

    return certification;
  }
}
