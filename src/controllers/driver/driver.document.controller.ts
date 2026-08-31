import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverDocumentService } from "../../services/driver/driver.document.service";
import { uploadDocumentSchema } from "../../utils/types/driverValidatorSchema";

export class DriverDocumentController {
  private documentService = new DriverDocumentService();

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.documentService.list(req.userId as string);

      res.status(200).json({ message: "Documents fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  upload = async (req: IUserRequest, res: Response) => {
    try {
      const { type } = uploadDocumentSchema.parse(req.body);

      if (!req.file) return res.status(400).json({ message: "No file was uploaded" });

      const result = await this.documentService.upload(req.userId as string, type, req.file);

      res.status(201).json({ message: "Document uploaded", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  remove = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.documentService.remove(req.userId as string, req.params.id);

      res.status(200).json({ message: "Document removed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
