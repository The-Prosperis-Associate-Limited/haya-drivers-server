import type { Response } from "express";
import { ClientHireRequestsService } from "../../services/client/client.hireRequests.service";
import { AdminHiresService } from "../../services/admin/admin.hires.service";
import { handleErrors } from "../../helper/handleErrors";
import { createHireRequestSchema, declineHireRequestSchema, generateInvoiceSchema, hireRequestListQuerySchema, submitProofSchema, rejectProofSchema, assignDriverSchema } from "../../utils/types/hireValidatorSchema";
import type { IUserRequest } from "../../interface";

export class HireRequestController {
  private clientService = new ClientHireRequestsService();
  private adminService = new AdminHiresService();

  create = async (req: IUserRequest, res: Response) => {
    try {
      const data = createHireRequestSchema.parse(req.body);

      const result = await this.clientService.create(req.userId as string, data);

      res.status(201).json({ message: "Hire request submitted", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  list = async (req: IUserRequest, res: Response) => {
    try {
      const query = hireRequestListQuerySchema.parse(req.query);

      const result = await this.clientService.list(req.userId as string, query);

      res.status(200).json({ message: "Hire requests fetched", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.clientService.get(req.userId as string, req.params.reference as string);

      res.status(200).json({ message: "Hire request fetched", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  submitProof = async (req: IUserRequest, res: Response) => {
    try {
      const data = submitProofSchema.parse(req.body);

      const result = await this.clientService.submitProof(req.userId as string, req.params.reference as string, req.file, data);

      res.status(200).json({ message: "Proof of payment submitted - we'll confirm it shortly", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  cancel = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.clientService.cancel(req.userId as string, req.params.reference as string);

      res.status(200).json({ message: "Hire request cancelled", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  adminList = async (req: IUserRequest, res: Response) => {
    try {
      const query = hireRequestListQuerySchema.parse(req.query);

      const result = await this.adminService.list(query);

      res.status(200).json({ message: "Hire requests fetched", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  adminGet = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.adminService.get(req.params.reference as string);

      res.status(200).json({ message: "Hire request fetched", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  assignDriver = async (req: IUserRequest, res: Response) => {
    try {
      const data = assignDriverSchema.parse(req.body);

      const result = await this.adminService.assignDriver(req.params.reference as string, req.userId as string, data);

      res.status(200).json({ message: "Driver assigned", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  unassignDriver = async (req: IUserRequest, res: Response) => {
    try {
      const data = assignDriverSchema.parse(req.body);

      const result = await this.adminService.unassignDriver(req.params.reference as string, req.userId as string, data);

      res.status(200).json({ message: "Driver removed from the request", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  generateInvoice = async (req: IUserRequest, res: Response) => {
    try {
      const data = generateInvoiceSchema.parse(req.body);

      const result = await this.adminService.generateInvoice(req.params.reference as string, req.userId as string, data);

      res.status(200).json({ message: "Invoice generated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  confirmPayment = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.adminService.confirmPayment(req.params.reference as string, req.userId as string);

      res.status(200).json({ message: "Payment confirmed - engagement created", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  rejectProof = async (req: IUserRequest, res: Response) => {
    try {
      const data = rejectProofSchema.parse(req.body);

      const result = await this.adminService.rejectProof(req.params.reference as string, req.userId as string, data);

      res.status(200).json({ message: "Proof of payment rejected", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  decline = async (req: IUserRequest, res: Response) => {
    try {
      const data = declineHireRequestSchema.parse(req.body);

      const result = await this.adminService.decline(req.params.reference as string, req.userId as string, data);

      res.status(200).json({ message: "Hire request declined", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
