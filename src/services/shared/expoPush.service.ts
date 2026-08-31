import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { DeviceTokenRepository } from "../../repositories/platform/deviceToken.repository";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class ExpoPushService {
  private deviceTokenRepo = new DeviceTokenRepository();

  async sendToUser(userId: string, payload: PushPayload) {
    try {
      const devices = await this.deviceTokenRepo.findForUser(userId);
      const tokens = devices.map(device => device.token).filter(token => Expo.isExpoPushToken(token));

      if (!tokens.length) return;

      const messages: ExpoPushMessage[] = tokens.map(to => ({
        to,
        sound: "default",
        // Android delivers silently to a channel the app has not created, so
        // this has to be set on every message or the banner never shows.
        channelId: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data,
      }));

      const tickets: ExpoPushTicket[] = [];

      for (const chunk of expo.chunkPushNotifications(messages)) {
        tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
      }

      await this.pruneDeadTokens(tokens, tickets);
    } catch (error) {
      // Swallowed for the same reason the caller does not await this: a push
      // failure must never surface as a failed request.
      console.error("Expo push failed:", error);
    }
  }

  // Expo reports an uninstalled or reset device as DeviceNotRegistered and will
  // eventually rate-limit a sender that keeps pushing to one. Tickets come back
  // positionally, so index maps back to the token it belongs to.
  private async pruneDeadTokens(tokens: string[], tickets: ExpoPushTicket[]) {
    const dead = tickets
      .map((ticket, index) => ({ ticket, token: tokens[index] }))
      .filter(({ ticket }) => ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered")
      .map(({ token }) => token);

    if (dead.length) await this.deviceTokenRepo.deleteMany(dead);
  }
}
