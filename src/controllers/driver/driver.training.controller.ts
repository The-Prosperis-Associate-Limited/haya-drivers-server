import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverTrainingService } from "../../services/driver/driver.training.service";
import { moduleProgressSchema } from "../../utils/types/trainingValidatorSchema";

export class DriverTrainingController {
  private trainingService = new DriverTrainingService();

  listCourses = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.listCourses(req.query);

      res.status(200).json({ message: "Courses fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  getCourse = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.getCourse(req.userId as string, req.params.slug);

      res.status(200).json({ message: "Course fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  enroll = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.enroll(req.userId as string, req.params.slug);

      res.status(201).json({ message: "Enrolled successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  listEnrollments = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.listEnrollments(req.userId as string, req.query);

      res.status(200).json({ message: "Enrollments fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  recordProgress = async (req: IUserRequest, res: Response) => {
    try {
      const data = moduleProgressSchema.parse(req.body);

      const result = await this.trainingService.recordModuleProgress(req.userId as string, req.params.slug, req.params.moduleId, data);

      res.status(200).json({ message: "Progress saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  listCertifications = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.listCertifications(req.userId as string);

      res.status(200).json({ message: "Certifications fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  stats = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.stats(req.userId as string);

      res.status(200).json({ message: "Training stats fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
