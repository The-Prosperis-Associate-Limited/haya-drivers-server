import { Router } from "express";
import { DriverTrainingController } from "../../controllers/driver/driver.training.controller";

const trainingRouter = Router();
const training = new DriverTrainingController();

trainingRouter.get("/stats", training.stats);
trainingRouter.get("/courses", training.listCourses);
trainingRouter.get("/path", training.requiredPath);
trainingRouter.get("/enrollments", training.listEnrollments);
trainingRouter.get("/certifications", training.listCertifications);

trainingRouter.get("/courses/:slug", training.getCourse);
trainingRouter.post("/courses/:slug/enroll", training.enroll);
trainingRouter.put("/courses/:slug/modules/:moduleId/progress", training.recordProgress);

export { trainingRouter };
