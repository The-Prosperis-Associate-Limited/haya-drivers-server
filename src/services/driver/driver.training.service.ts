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

  async listCourses(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { courses, total } = await this.courseRepo.findPublished({
      ...pagination,
      userId,
      search: query.search as string | undefined,
      category: query.category as string | undefined,
    });

    return paginate(courses.map(course => this.withEnrollment(course)), total, pagination);
  }

  /*
    The required path is walked in order and each course unlocks the next, so a
    driver cannot skip ahead to the assessment they like the look of. Locking is
    presentational - the server still refuses progress on a course they have not
    reached, because hiding a button is not a rule.
  */
  async requiredPath(userId: string) {
    const courses = await this.courseRepo.findRequiredPath(userId);

    let previousCompleted = true;

    return courses.map(course => {
      const withEnrollment = this.withEnrollment(course);
      const locked = !previousCompleted && withEnrollment.enrollment?.status !== "COMPLETED";

      previousCompleted = withEnrollment.enrollment?.status === "COMPLETED";

      return { ...withEnrollment, locked };
    });
  }

  private withEnrollment<T extends { enrollments?: unknown[] }>(course: T) {
    const { enrollments, ...rest } = course;

    return { ...rest, enrollment: (enrollments?.[0] as Record<string, unknown> | undefined) ?? null };
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
    const existing = await this.enrollmentRepo.findModuleProgress(enrollment.id, moduleId);

    /*
      Completion never moves backwards. A driver rewatching a module they already
      finished sends position pings with `completed` undefined, and those must not
      clear the tick - losing it would drop their course progress and, on the last
      module, un-finish a course they have already been certified for.
    */
    const completed_at = existing?.completed_at ?? (data.completed ? new Date() : null);

    // Furthest point reached, not most recent: scrubbing back to re-watch
    // something should not lose the driver's place.
    const last_position_seconds = Math.max(existing?.last_position_seconds ?? 0, data.position_seconds ?? 0);

    await this.enrollmentRepo.upsertModuleProgress(enrollment.id, moduleId, {
      completed_at,
      minutes_spent: Math.max(existing?.minutes_spent ?? 0, data.minutes_spent),
      last_position_seconds,
      duration_seconds: data.duration_seconds ?? existing?.duration_seconds ?? null,
    });

    const completedModules = await this.enrollmentRepo.countCompletedModules(enrollment.id);
    const progress = course.modules.length ? Math.round((completedModules / course.modules.length) * 100) : 0;
    const isComplete = progress >= 100;

    // Only a module that just crossed the line adds time; a position ping on a
    // module already finished would otherwise inflate the total every few seconds.
    const isNewlyCompleted = !existing?.completed_at && !!completed_at;

    await this.enrollmentRepo.update(enrollment.id, {
      progress,
      status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      ...(isNewlyCompleted && { minutes_spent: { increment: data.minutes_spent } }),
      completed_at: isComplete ? (enrollment.completed_at ?? new Date()) : null,
    });

    if (isComplete) await this.issueCertification(userId, course);

    return { progress, completed: isComplete, last_position_seconds };
  }

  async listCertifications(userId: string) {
    return this.certificationRepo.findForUser(userId);
  }

  async stats(userId: string) {
    const [certifications, inProgress, minutes, breakdown, requiredCourses, requiredCompleted] = await Promise.all([
      this.certificationRepo.countForUser(userId),
      this.enrollmentRepo.countForUser(userId, "IN_PROGRESS"),
      this.enrollmentRepo.sumMinutesForUser(userId),
      this.trustScoreService.breakdown(userId),
      this.courseRepo.countRequired(),
      this.enrollmentRepo.countRequiredCompletedForUser(userId),
    ]);

    return {
      certifications_earned: certifications,
      modules_in_progress: inProgress,
      trust_score_boost: breakdown.training,
      minutes_invested: minutes,
      required_courses: requiredCourses,
      required_courses_completed: requiredCompleted,
      completion_percent: requiredCourses ? Math.round((requiredCompleted / requiredCourses) * 100) : 0,
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
