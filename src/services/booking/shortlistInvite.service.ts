import type { $Enums } from "../../generated/prisma/client";
import { UserRepository } from "../../repositories/user/user.repository";
import { SHORTLIST_WINDOW_HOURS } from "../../utils/shortlistWindow";
import { surfaceUrlFor } from "../../utils/surfaceUrl";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { NotificationService } from "../shared/notification.service";

interface InvitedRequest {
  reference: string;
  engagement_type: $Enums.EngagementType;
  starts_at: Date;
  state: string | null;
}

// The invitation never names the client - drivers only see job facts until they're hired.
export class ShortlistInviteService {
  private userRepo = new UserRepository();
  private notificationService = new NotificationService();

  async invite(request: InvitedRequest, driverId: string, options: { senderId?: string; requestedByName?: boolean } = {}) {
    const engagement = request.engagement_type === "MONTHLY" ? "full-time" : "contract";

    await this.notificationService.notify({
      recipientId: driverId,
      senderId: options.senderId,
      type: "BOOKING_REQUEST",
      title: options.requestedByName ? "A client asked for you by name" : "You've been shortlisted for an engagement",
      message: `You're a candidate for a ${engagement} engagement starting ${request.starts_at.toDateString()}${request.state ? ` in ${request.state}` : ""}. Confirm your availability from your dashboard within ${SHORTLIST_WINDOW_HOURS} hours.`,
      actionUrl: "/dashboard",
      metadata: { reference: request.reference },
    });

    const driver = await this.userRepo.findById(driverId, { email: true, first_name: true });

    if (driver?.email && (await this.notificationService.wants(driverId, "job_requests"))) {
      await queueEmail(JOB_KEY.HIRE_REQUEST_EVENT, {
        email: driver.email as string,
        first_name: (driver.first_name as string) ?? "there",
        event: "SHORTLISTED",
        reference: request.reference,
        date: request.starts_at.toDateString(),
        counterpart: request.state ?? undefined,
        actionUrl: `${surfaceUrlFor("DRIVER")}/dashboard`,
      });
    }
  }
}
