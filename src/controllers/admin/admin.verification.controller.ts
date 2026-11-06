import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { AdminVerificationService } from "../../services/admin/admin.verification.service";
import { reviewDocumentSchema, reviewVerificationSchema } from "../../utils/types/driverValidatorSchema";

export class AdminVerificationController {
  private verificationService = new AdminVerificationService();

  queue = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.verificationService.queue(req.query);

      res.status(200).json({ message: "Verification queue fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  documentUpdates = async (_req: IUserRequest, res: Response) => {
    try {
      const data = await this.verificationService.documentUpdates();

      res.status(200).json({ message: "Document updates fetched successfully", data });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  requiredDocumentsNotice = async (_req: IUserRequest, res: Response) => {
    try {
      const data = await this.verificationService.requiredDocumentsNotice();

      res.status(200).json({ message: "Notice audience fetched successfully", data });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  sendRequiredDocumentsNotice = async (_req: IUserRequest, res: Response) => {
    try {
      const data = await this.verificationService.sendRequiredDocumentsNotice();

      res.status(200).json({ message: `Notice sent to ${data.sent} driver${data.sent === 1 ? "" : "s"}`, data });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.verificationService.getSubmission(req.params.userId);

      res.status(200).json({ message: "Submission fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reviewDocument = async (req: IUserRequest, res: Response) => {
    try {
      const data = reviewDocumentSchema.parse(req.body);

      const result = await this.verificationService.reviewDocument(req.params.documentId, req.userId as string, data);

      res.status(200).json({ message: "Document reviewed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reviewSubmission = async (req: IUserRequest, res: Response) => {
    try {
      const data = reviewVerificationSchema.parse(req.body);

      const result = await this.verificationService.reviewSubmission(req.params.userId, req.userId as string, data);

      res.status(200).json({ message: "Verification reviewed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
