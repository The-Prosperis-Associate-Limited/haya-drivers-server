import { Response } from "express";
import { handleErrors } from "../helper/handleErrors";
import { IUserRequest } from "../interface";
import { TicketService } from "../services/shared/ticket.service";
import { createTicketSchema, ticketCommentSchema, updateTicketSchema } from "../utils/types/ticketValidatorSchema";

export class TicketController {
  private ticketService = new TicketService();

  create = async (req: IUserRequest, res: Response) => {
    try {
      const data = createTicketSchema.parse(req.body);

      const result = await this.ticketService.create(req.userId as string, data);

      res.status(201).json({ message: "Ticket created", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.ticketService.listForUser(req.userId as string, req.query);

      res.status(200).json({ message: "Tickets fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  get = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.ticketService.get(req.params.id, req.userId as string, req.role as string);

      res.status(200).json({ message: "Ticket fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  comment = async (req: IUserRequest, res: Response) => {
    try {
      const data = ticketCommentSchema.parse(req.body);

      const result = await this.ticketService.comment(req.params.id, req.userId as string, req.role as string, data);

      res.status(201).json({ message: "Comment added", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  listAll = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.ticketService.listAll(req.query);

      res.status(200).json({ message: "Tickets fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  update = async (req: IUserRequest, res: Response) => {
    try {
      const data = updateTicketSchema.parse(req.body);

      const result = await this.ticketService.updateStatus(req.params.id, data);

      res.status(200).json({ message: "Ticket updated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
