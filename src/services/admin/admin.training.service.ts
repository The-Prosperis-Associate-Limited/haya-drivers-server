import type { $Enums } from "../../generated/prisma/client";
import { CourseModuleRepository } from "../../repositories/training/courseModule.repository";
import { CourseRepository } from "../../repositories/training/course.repository";
import { EnrollmentRepository } from "../../repositories/training/enrollment.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import type { CreateCourseInput, CreateModuleInput } from "../../utils/types/trainingValidatorSchema";

export class AdminTrainingService {
  private courseRepo = new CourseRepository();
  private moduleRepo = new CourseModuleRepository();
  private enrollmentRepo = new EnrollmentRepository();

  async stats() {
    return this.courseRepo.adminStats();
  }

  async progress(query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { enrollments, total } = await this.enrollmentRepo.findAllForAdmin({
      ...pagination,
      status: query.status as $Enums.EnrollmentStatus | undefined,
      search: query.search as string | undefined,
    });

    return paginate(enrollments, total, pagination);
  }

  async listCourses(query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { courses, total } = await this.courseRepo.findAllForAdmin({ ...pagination, status: query.status as $Enums.CourseStatus | undefined });

    return paginate(courses, total, pagination);
  }

  async getCourse(id: string) {
    const course = await this.courseRepo.findById(id);

    if (!course) throw new NotFoundError("Course not found");

    return course;
  }

  async createCourse(data: CreateCourseInput) {
    return this.courseRepo.create(data);
  }

  async updateCourse(id: string, data: Partial<CreateCourseInput>) {
    await this.getCourse(id);

    return this.courseRepo.update(id, data);
  }

  // Publishing an empty course puts a dead card on the training screen, so the
  // transition is refused rather than silently allowed.
  async publishCourse(id: string) {
    const modules = await this.moduleRepo.countForCourse(id);

    if (!modules) throw new BadRequestError("Add at least one module before publishing this course");

    return this.courseRepo.update(id, { status: "PUBLISHED" });
  }

  // Back to DRAFT rather than ARCHIVED - an unpublished course is expected to return.
  async unpublishCourse(id: string) {
    await this.getCourse(id);

    return this.courseRepo.update(id, { status: "DRAFT" });
  }

  async deleteCourse(id: string) {
    await this.getCourse(id);

    return this.courseRepo.delete(id);
  }

  async addModule(courseId: string, data: CreateModuleInput) {
    await this.getCourse(courseId);

    return this.moduleRepo.create({
      ...data,
      courseId,
      position: data.position ?? (await this.moduleRepo.nextPosition(courseId)),
    });
  }

  async updateModule(id: string, data: Partial<CreateModuleInput>) {
    const module = await this.moduleRepo.findById(id);

    if (!module) throw new NotFoundError("Module not found");

    return this.moduleRepo.update(id, data);
  }

  async deleteModule(id: string) {
    const module = await this.moduleRepo.findById(id);

    if (!module) throw new NotFoundError("Module not found");

    return this.moduleRepo.delete(id);
  }
}
