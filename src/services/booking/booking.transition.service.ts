import type { $Enums } from "../../generated/prisma/client";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { formatMoney } from "../../utils/money";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { NotificationService } from "../shared/notification.service";
import { ActivityService } from "../shared/activity.service";
import { TrustScoreService } from "../shared/trustScore.service";
import { SalaryService } from "./salary.service";

const { CLIENT_URL } = process.env;

/*
  The status machine lives here and nowhere else. Both the driver and the client
  side call into it, so a transition always writes its event row and notifies
  the other party. No money moves on completion - the client pays the driver's
  salary directly, outside the platform.
*/
const ALLOWED_TRANSITIONS: Record<$Enums.BookingStatus, $Enums.BookingStatus[]> = {
  REQUESTED: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  DECLINED: [],
  CANCELLED: [],
  IN_PROGRESS: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  DISPUTED: ["COMPLETED", "CANCELLED"],
};

export class BookingTransitionService {
  private bookingRepo = new BookingRepository();
  private statusEventRepo = new BookingStatusEventRepository();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();
  private trustScoreService = new TrustScoreService();
  private salaryService = new SalaryService();

  async transition(bookingId: string, to: $Enums.BookingStatus, actorId: string, options: { note?: string; reason?: string } = {}) {
    const booking = await this.bookingRepo.findById(bookingId);

    if (!booking) throw new NotFoundError("Booking not found");

    if (!ALLOWED_TRANSITIONS[booking.status].includes(to)) {
      throw new BadRequestError(`A ${booking.status.toLowerCase().replace(/_/g, " ")} booking cannot become ${to.toLowerCase().replace(/_/g, " ")}`);
    }

    const timestamps: Record<string, Date | string | null> = {};

    if (to === "ACCEPTED") timestamps.accepted_at = new Date();
    if (to === "DECLINED") {
      timestamps.declined_at = new Date();
      timestamps.decline_reason = options.reason ?? null;
    }
    if (to === "CANCELLED") {
      timestamps.cancelled_at = new Date();
      timestamps.cancelled_by = actorId;
    }
    if (to === "IN_PROGRESS") timestamps.started_at = new Date();
    if (to === "COMPLETED") timestamps.completed_at = new Date();

    const updated = await this.bookingRepo.update(bookingId, { status: to, ...timestamps });

    await this.statusEventRepo.create({
      bookingId,
      from_status: booking.status,
      to_status: to,
      changed_by: actorId,
      note: options.note ?? options.reason,
    });

    if (to === "COMPLETED" && booking.driverId) await this.trustScoreService.recompute(booking.driverId);
    if (to === "COMPLETED" || to === "CANCELLED") await this.salaryService.sync(updated);

    await this.announce(updated, to, actorId, options.reason);

    return updated;
  }

  private async announce(booking: NonNullable<Awaited<ReturnType<BookingRepository["findById"]>>>, to: $Enums.BookingStatus, actorId: string, reason?: string) {
    const driverName = [booking.driver?.first_name, booking.driver?.last_name].filter(Boolean).join(" ") || "Your driver";
    const clientName = booking.client.client_profile?.organisation_name || [booking.client.first_name, booking.client.last_name].filter(Boolean).join(" ") || "A client";

    // Whoever made the change already knows; the other party is the one who
    // needs telling.
    const recipientId = actorId === booking.driverId ? booking.clientId : booking.driverId;

    if (!recipientId) return;

    const isDriverRecipient = recipientId === booking.driverId;
    const recipient = isDriverRecipient ? booking.driver : booking.client;

    await this.notificationService.notify({
      recipientId,
      senderId: actorId,
      type: "BOOKING_STATUS",
      title: STATUS_TITLES[to],
      message: `${booking.title} is now ${to.toLowerCase().replace(/_/g, " ")}.${reason ? ` ${reason}` : ""}`,
      actionUrl: `/dashboard/job-request/${booking.reference}`,
      metadata: { bookingId: booking.id, reference: booking.reference },
      essential: to === "CANCELLED",
    });

    await this.activityService.record(actorId, ACTIVITY_TYPES[to] ?? "BOOKING_CREATED", `${STATUS_TITLES[to]}: ${booking.title}`);

    const wantsEmail = to === "CANCELLED" || (await this.notificationService.wants(recipientId, "job_requests"));

    if (EMAILED_STATUSES.includes(to) && recipient?.id && wantsEmail) {
      await queueEmail(JOB_KEY.BOOKING_STATUS, {
        email: (recipient as { email?: string }).email ?? "",
        first_name: recipient.first_name ?? "there",
        title: booking.title,
        status: to as "ACCEPTED" | "DECLINED" | "CANCELLED" | "COMPLETED",
        counterpartName: isDriverRecipient ? clientName : driverName,
        date: booking.starts_at.toDateString(),
        time: booking.starts_at.toTimeString().slice(0, 5),
        location: booking.pickup_address,
        reference: booking.reference,
        baseUrl: CLIENT_URL as string,
        note: reason,
      });
    }
  }
}

const STATUS_TITLES: Record<$Enums.BookingStatus, string> = {
  REQUESTED: "New job request",
  ACCEPTED: "Booking confirmed",
  DECLINED: "Booking declined",
  CANCELLED: "Booking cancelled",
  IN_PROGRESS: "Job started",
  COMPLETED: "Job completed",
  DISPUTED: "Booking disputed",
};

const ACTIVITY_TYPES: Partial<Record<$Enums.BookingStatus, $Enums.ActivityType>> = {
  ACCEPTED: "BOOKING_ACCEPTED",
  DECLINED: "BOOKING_DECLINED",
  CANCELLED: "BOOKING_CANCELLED",
  COMPLETED: "BOOKING_COMPLETED",
};

const EMAILED_STATUSES: $Enums.BookingStatus[] = ["ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED"];

export const formatBookingAmount = (booking: { amount: number; currency: string }) => formatMoney(booking.amount, booking.currency);
