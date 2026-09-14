import { Router } from "express";
import { AdminTrainingController } from "../../controllers/admin/admin.training.controller";

const adminTrainingRouter = Router();
const training = new AdminTrainingController();

adminTrainingRouter.get("/stats", training.stats);
adminTrainingRouter.get("/progress", training.progress);

adminTrainingRouter.get("/courses", training.listCourses);
adminTrainingRouter.post("/courses", training.createCourse);
adminTrainingRouter.get("/courses/:id", training.getCourse);
adminTrainingRouter.put("/courses/:id", training.updateCourse);
adminTrainingRouter.patch("/courses/:id/publish", training.publishCourse);
adminTrainingRouter.patch("/courses/:id/unpublish", training.unpublishCourse);
adminTrainingRouter.delete("/courses/:id", training.deleteCourse);

adminTrainingRouter.post("/courses/:id/modules", training.addModule);
adminTrainingRouter.put("/modules/:moduleId", training.updateModule);
adminTrainingRouter.delete("/modules/:moduleId", training.deleteModule);

export { adminTrainingRouter };
