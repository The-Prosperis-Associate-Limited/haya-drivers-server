import { Router } from "express";
import { DriverReviewController } from "../../controllers/driver/driver.review.controller";

const reviewRouter = Router();
const reviews = new DriverReviewController();

reviewRouter.get("/", reviews.list);
reviewRouter.get("/summary", reviews.summary);

export { reviewRouter };
