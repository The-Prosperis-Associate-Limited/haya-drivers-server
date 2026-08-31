import { Response } from "express";
import { handleErrors } from "../helper/handleErrors";
import { IUserRequest } from "../interface";
import { DeviceTokenRepository } from "../repositories/platform/deviceToken.repository";
import { PushSubscriptionRepository } from "../repositories/platform/pushSubscription.repository";
import { registerDeviceTokenSchema, unregisterDeviceTokenSchema } from "../utils/types/authValidatorSchema";

export class PushSubscriptionController {
  private deviceTokenRepo = new DeviceTokenRepository();
  private pushSubscriptionRepo = new PushSubscriptionRepository();

  registerDeviceToken = async (req: IUserRequest, res: Response) => {
    try {
      const data = registerDeviceTokenSchema.parse(req.body);

      const result = await this.deviceTokenRepo.register({ userId: req.userId as string, ...data });

      res.status(201).json({ message: "Device registered", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  unregisterDeviceToken = async (req: IUserRequest, res: Response) => {
    try {
      const { token } = unregisterDeviceTokenSchema.parse(req.body);

      await this.deviceTokenRepo.unregister(token);

      res.status(200).json({ message: "Device unregistered" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  // Subscriptions are collected but nothing sends Web Push yet — the Expo path
  // is the live one. Wire a sender before relying on these rows.
  subscribeWebPush = async (req: IUserRequest, res: Response) => {
    try {
      const { endpoint, keys, expirationTime } = req.body;

      if (!endpoint) return res.status(400).json({ message: "A push endpoint is required" });

      const result = await this.pushSubscriptionRepo.upsertForUser(req.userId as string, {
        endpoint,
        p256dh: keys?.p256dh,
        auth: keys?.auth,
        expirationTime: expirationTime ? new Date(expirationTime) : null,
      });

      res.status(201).json({ message: "Subscribed to push notifications", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  unsubscribeWebPush = async (req: IUserRequest, res: Response) => {
    try {
      await this.pushSubscriptionRepo.deleteForUser(req.userId as string);

      res.status(200).json({ message: "Unsubscribed from push notifications" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
