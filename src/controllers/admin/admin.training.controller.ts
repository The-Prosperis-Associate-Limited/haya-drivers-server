import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminTrainingService } from "../../services/admin/admin.training.service";
import { createCourseSchema, createModuleSchema, updateCourseSchema, updateModuleSchema } from "../../utils/types/trainingValidatorSchema";

export class AdminTrainingController {
  private trainingService = new AdminTrainingService();

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
      const result = await this.trainingService.getCourse(req.params.id);

      res.status(200).json({ message: "Course fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  createCourse = async (req: IUserRequest, res: Response) => {
    try {
      const data = createCourseSchema.parse(req.body);

      const result = await this.trainingService.createCourse(data);

      res.status(201).json({ message: "Course created", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  updateCourse = async (req: IUserRequest, res: Response) => {
    try {
      const data = updateCourseSchema.parse(req.body);

      const result = await this.trainingService.updateCourse(req.params.id, data);

      res.status(200).json({ message: "Course updated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  publishCourse = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.publishCourse(req.params.id);

      res.status(200).json({ message: "Course published", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  deleteCourse = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.deleteCourse(req.params.id);

      res.status(200).json({ message: "Course deleted", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  addModule = async (req: IUserRequest, res: Response) => {
    try {
      const data = createModuleSchema.parse(req.body);

      const result = await this.trainingService.addModule(req.params.id, data);

      res.status(201).json({ message: "Module added", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  updateModule = async (req: IUserRequest, res: Response) => {
    try {
      const data = updateModuleSchema.parse(req.body);

      const result = await this.trainingService.updateModule(req.params.moduleId, data);

      res.status(200).json({ message: "Module updated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  deleteModule = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.trainingService.deleteModule(req.params.moduleId);

      res.status(200).json({ message: "Module deleted", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
