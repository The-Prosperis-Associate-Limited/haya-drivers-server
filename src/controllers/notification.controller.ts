import { Response } from "express";
import { handleErrors } from "../helper/handleErrors";
import { IUserRequest } from "../interface";
import { NotificationService } from "../services/shared/notification.service";
import { notificationPreferenceSchema } from "../utils/types/notificationValidatorSchema";

export class NotificationController {
  private notificationService = new NotificationService();

  preferences = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.notificationService.getPreferences(req.userId as string);

      res.status(200).json({ message: "Notification preferences fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  updatePreferences = async (req: IUserRequest, res: Response) => {
    try {
      const data = notificationPreferenceSchema.parse(req.body);

      const result = await this.notificationService.updatePreferences(req.userId as string, data);

      res.status(200).json({ message: "Notification preferences updated", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  list = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.notificationService.list(req.userId as string, req.query);

      res.status(200).json({ message: "Notifications fetched successfully", ...result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  unreadCount = async (req: IUserRequest, res: Response) => {
    try {
      const count = await this.notificationService.countUnread(req.userId as string);

      res.status(200).json({ message: "Unread count fetched successfully", data: { count } });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  markAsRead = async (req: IUserRequest, res: Response) => {
    try {
      await this.notificationService.markAsRead(req.params.id, req.userId as string);

      res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  markAllAsRead = async (req: IUserRequest, res: Response) => {
    try {
      await this.notificationService.markAllAsRead(req.userId as string);

      res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  remove = async (req: IUserRequest, res: Response) => {
    try {
      await this.notificationService.delete(req.params.id, req.userId as string);

      res.status(200).json({ message: "Notification deleted" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
