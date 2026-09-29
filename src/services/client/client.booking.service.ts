import type { $Enums } from "../../generated/prisma/client";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingStatusEventRepository } from "../../repositories/booking/bookingStatusEvent.repository";
import { ReviewRepository } from "../../repositories/booking/review.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { formatMoney, toMinorUnits } from "../../utils/money";
import { paginate, parsePagination } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { BookingTransitionService } from "../booking/booking.transition.service";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";
import { TrustScoreService } from "../shared/trustScore.service";
import type { CreateBookingInput, ReviewBookingInput } from "../../utils/types/bookingValidatorSchema";

const { CLIENT_URL } = process.env;

export class ClientBookingService {
  private bookingRepo = new BookingRepository();
  private statusEventRepo = new BookingStatusEventRepository();
  private reviewRepo = new ReviewRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private userRepo = new UserRepository();
  private transitionService = new BookingTransitionService();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();
  private trustScoreService = new TrustScoreService();

  async create(clientId: string, data: CreateBookingInput) {
    // Checked on the way in, not just filtered out of search: a stale driver id
    // from a cached list must not create a booking against an unverified driver.
    const driverProfile = await this.driverProfileRepo.findByUserId(data.driverId, { verification_status: true, is_discoverable: true });

    if (!driverProfile) throw new NotFoundError("Driver not found");
    if (driverProfile.verification_status !== "APPROVED" || !driverProfile.is_discoverable) throw new BadRequestError("That driver is not available for booking");

    const driver = await this.userRepo.findById(data.driverId, { email: true, first_name: true });

    const { amount, driverId, ...rest } = data;

    const booking = await this.bookingRepo.create({
      ...rest,
      driverId,
      clientId,
      reference: generateReference("JOB"),
      amount: toMinorUnits(amount),
      status: "REQUESTED",
    });

    await this.statusEventRepo.create({ bookingId: booking.id, to_status: "REQUESTED", changed_by: clientId });

    const client = (await this.userRepo.findById(clientId, {
      first_name: true,
      last_name: true,
      client_profile: { select: { organisation_name: true } },
    })) as { first_name: string | null; last_name: string | null; client_profile: { organisation_name: string | null } | null } | null;

    const clientName = client?.client_profile?.organisation_name || [client?.first_name, client?.last_name].filter(Boolean).join(" ") || "A client";

    await this.notificationService.notify({
      recipientId: driverId,
      senderId: clientId,
      type: "BOOKING_REQUEST",
      title: "New job request",
      message: `${clientName} wants to book you for ${booking.title}.`,
      actionUrl: `/dashboard/job-request/${booking.reference}`,
      metadata: { bookingId: booking.id, reference: booking.reference },
    });

    await queueEmail(JOB_KEY.BOOKING_REQUEST, {
      email: driver?.email as string,
      first_name: (driver?.first_name as string) ?? "there",
      clientName,
      title: booking.title,
      date: booking.starts_at.toDateString(),
      time: booking.starts_at.toTimeString().slice(0, 5),
      location: booking.pickup_address,
      amount: formatMoney(booking.amount, booking.currency),
      reference: booking.reference,
      baseUrl: CLIENT_URL as string,
    });

    await this.activityService.record(clientId, "BOOKING_CREATED", `Requested ${booking.title}`);

    return booking;
  }

  async list(clientId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { bookings, total } = await this.bookingRepo.findForClient(clientId, { ...pagination, status: query.status as $Enums.BookingStatus | undefined });

    return paginate(bookings, total, pagination);
  }

  async get(clientId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.clientId !== clientId) throw new ForbiddenError("That booking belongs to another client");

    const events = await this.statusEventRepo.findForBooking(booking.id);

    return { ...booking, status_events: events };
  }

  async cancel(clientId: string, reference: string, reason: string) {
    const booking = await this.get(clientId, reference);

    return this.transitionService.transition(booking.id, "CANCELLED", clientId, { reason });
  }

  async review(clientId: string, reference: string, data: ReviewBookingInput) {
    const booking = await this.get(clientId, reference);

    // A monthly hire runs for months - the client reviews the driver while the
    // engagement is live, not only after it ends. Unanswered requests stay
    // unreviewable: nobody reviews a driver who never worked for them.
    const reviewable = booking.accepted_at && ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(booking.status);

    if (!reviewable) throw new BadRequestError("You can review a driver once they have taken the job");
    if (!booking.driverId) throw new BadRequestError("This booking has no driver to review");

    const existing = await this.reviewRepo.findByBooking(booking.id);

    if (existing) throw new BadRequestError("You have already reviewed this job");

    const scores = Object.values(data.criteria ?? {});
    const rating = data.rating ?? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

    const review = await this.reviewRepo.create({
      bookingId: booking.id,
      authorId: clientId,
      subjectId: booking.driverId,
      rating,
      comment: data.comment,
      criteria: data.criteria,
    });

    // A review moves the trust score, which is what the client search sorts by.
    await this.trustScoreService.recompute(booking.driverId);

    await this.notificationService.notify({
      recipientId: booking.driverId,
      senderId: clientId,
      type: "BOOKING_STATUS",
      title: "New review",
      message: `You received a ${data.rating}-star review for ${booking.title}.`,
      actionUrl: "/dashboard",
    });

    return review;
  }
}
