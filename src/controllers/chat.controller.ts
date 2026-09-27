import type { Response } from "express";
import { ChatService } from "../services/shared/chat.service";
import { handleErrors } from "../helper/handleErrors";
import { chatInboxQuerySchema, chatMessageSchema } from "../utils/types/chatValidatorSchema";
import type { IUserRequest } from "../interface";
import type { $Enums } from "../generated/prisma/client";

export class ChatController {
  private chatService = new ChatService();

  getConversation = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.chatService.getConversation(req.userId as string);

      res.status(200).json({ message: "Conversation fetched", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  sendMessage = async (req: IUserRequest, res: Response) => {
    try {
      const data = chatMessageSchema.parse(req.body);

      const result = await this.chatService.sendUserMessage(req.userId as string, req.role as $Enums.UserRole, data.message);

      res.status(200).json({ message: "Message sent", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  markRead = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.chatService.markRead(req.params.conversationId as string, req.userId as string);

      res.status(200).json({ message: "Marked read", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  listInbox = async (req: IUserRequest, res: Response) => {
    try {
      const query = chatInboxQuerySchema.parse(req.query);

      const result = await this.chatService.listInbox(query);

      res.status(200).json({ message: "Inbox fetched", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  getForAdmin = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.chatService.getConversationForAdmin(req.params.conversationId as string, req.userId as string);

      res.status(200).json({ message: "Conversation fetched", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  join = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.chatService.joinConversation(req.params.conversationId as string, req.userId as string);

      res.status(200).json({ message: "Joined conversation", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reply = async (req: IUserRequest, res: Response) => {
    try {
      const data = chatMessageSchema.parse(req.body);

      const result = await this.chatService.sendAdminMessage(req.params.conversationId as string, req.userId as string, data.message);

      res.status(200).json({ message: "Reply sent", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  resolve = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.chatService.resolveConversation(req.params.conversationId as string, req.userId as string);

      res.status(200).json({ message: "Conversation resolved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
