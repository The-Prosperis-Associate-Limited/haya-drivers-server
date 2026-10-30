import type { SalaryPayment } from "../../generated/prisma/client";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { type AdminSalaryFilter, SalaryPaymentRepository, type SalaryPaymentWithBooking } from "../../repositories/booking/salaryPayment.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { formatMoney } from "../../utils/money";
import { paginate, parsePagination } from "../../utils/pagination";
import { isOverdue, SALARY_GRACE_DAYS, SALARY_REMINDER_EVERY_DAYS, salaryPeriods } from "../../utils/salarySchedule";
import { CloudinaryService } from "../shared/cloudinary.service";
import { NotificationService } from "../shared/notification.service";

type Booking = NonNullable<Awaited<ReturnType<BookingRepository["findByReference"]>>>;

type SyncableBooking = Pick<Booking, "id" | "clientId" | "driverId" | "engagement_type" | "status" | "starts_at" | "ends_at" | "amount" | "currency" | "completed_at" | "cancelled_at">;

const DAY_MS = 24 * 60 * 60 * 1000;

const SALARIED = ["MONTHLY", "CONTRACT"];

const nameOf = (person?: { first_name: string | null; last_name: string | null } | null, fallback = "Your driver") =>
  [person?.first_name, person?.last_name].filter(Boolean).join(" ") || fallback;

const clientNameOf = (client: { first_name: string | null; last_name: string | null; client_profile?: { organisation_name: string | null } | null }) =>
  client.client_profile?.organisation_name || nameOf(client, "The client");

const day = (at: Date) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(at);

// period_end is exclusive, so the last day worked is the millisecond before it.
export const periodLabel = (row: Pick<SalaryPayment, "period_start" | "period_end">) => `${day(row.period_start)} - ${day(new Date(row.period_end.getTime() - 1))}`;

const overdueCutoff = (now = new Date()) => new Date(now.getTime() - SALARY_GRACE_DAYS * DAY_MS);

export const serializeSalary = (row: SalaryPayment, now = new Date()) => ({
  id: row.id,
  period_start: row.period_start,
  period_end: row.period_end,
  period_label: periodLabel(row),
  due_at: row.due_at,
  amount_minor: row.amount_minor,
  currency: row.currency,
  status: row.status,
  overdue: isOverdue(row, now),
  paid_at: row.paid_at,
  receipt_url: row.receipt_url,
  client_note: row.client_note,
  confirmed_at: row.confirmed_at,
  disputed_at: row.disputed_at,
  dispute_reason: row.dispute_reason,
  resolution: row.resolution,
  resolution_note: row.resolution_note,
  resolved_at: row.resolved_at,
});

export const salaryWithParties = (row: SalaryPaymentWithBooking, now = new Date()) => ({
  ...serializeSalary(row, now),
  booking: { reference: row.booking.reference, title: row.booking.title, engagement_type: row.booking.engagement_type },
  client: { id: row.booking.client.id, name: clientNameOf(row.booking.client), profile_pic: row.booking.client.profile_pic },
  driver: row.booking.driver ? { id: row.booking.driver.id, name: nameOf(row.booking.driver, "Driver"), profile_pic: row.booking.driver.profile_pic } : null,
});

export class SalaryService {
  private salaryRepo = new SalaryPaymentRepository();
  private bookingRepo = new BookingRepository();
  private userRepo = new UserRepository();
  private cloudinaryService = new CloudinaryService();
  private notificationService = new NotificationService();

  // Brings a booking's pay periods up to date: opens periods as they start and cuts unpaid ones short when the engagement ends.
  async sync(booking: SyncableBooking) {
    if (!booking.driverId || !SALARIED.includes(booking.engagement_type) || ["REQUESTED", "DECLINED"].includes(booking.status)) return;

    const now = new Date();
    const endedAt = booking.status === "COMPLETED" ? booking.completed_at : booking.status === "CANCELLED" ? booking.cancelled_at : null;
    const periods = salaryPeriods(booking, now, endedAt);
    const existing = await this.salaryRepo.findForBooking(booking.id);
    const earliest = existing.at(-1)?.period_start;

    // Engagements that predate salary tracking start from the current period, so they don't open with months of phantom arrears.
    const wanted = earliest ? periods.filter(period => period.period_start >= earliest) : periods.filter(period => period.period_end > now);
    const known = new Set(existing.map(row => row.period_start.getTime()));

    await this.salaryRepo.createMany(
      wanted
        .filter(period => !known.has(period.period_start.getTime()))
        .map(period => ({ ...period, bookingId: booking.id, clientId: booking.clientId, driverId: booking.driverId as string, currency: booking.currency })),
    );

    const byStart = new Map(periods.map(period => [period.period_start.getTime(), period]));
    const stale = existing.filter(row => row.status === "DUE" && !byStart.has(row.period_start.getTime()));

    await this.salaryRepo.deleteMany(stale.map(row => row.id));

    for (const row of existing) {
      const period = byStart.get(row.period_start.getTime());

      if (row.status === "DUE" && period && (period.period_end.getTime() !== row.period_end.getTime() || period.amount_minor !== row.amount_minor)) {
        await this.salaryRepo.update(row.id, { period_end: period.period_end, due_at: period.due_at, amount_minor: period.amount_minor });
      }
    }
  }

  async syncAllActive() {
    const bookings = await this.bookingRepo.findActiveEngagements();

    for (const booking of bookings) await this.sync(booking);

    return bookings.length;
  }

  async clientList(clientId: string, reference: string) {
    return this.list(await this.clientBooking(clientId, reference));
  }

  async driverList(driverId: string, reference: string) {
    return this.list(await this.driverBooking(driverId, reference));
  }

  async adminBookingList(reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Booking not found");

    return this.list(booking);
  }

  async markPaid(clientId: string, reference: string, id: string, file: Express.Multer.File | undefined, note?: string) {
    const booking = await this.clientBooking(clientId, reference);
    const row = await this.ownRow(booking, id);

    if (row.status !== "DUE") throw new BadRequestError(row.status === "DISPUTED" ? "This salary is under review by our team" : "This salary is already marked as paid");

    const upload = file ? await this.cloudinaryService.uploadFile(clientId, "client", file, "payments") : null;
    const now = new Date();

    const updated = await this.salaryRepo.update(row.id, { status: "PAID", paid_at: now, receipt_url: upload?.secure_url ?? null, client_note: note ?? null });

    if (booking.driverId) {
      await this.notificationService.notify({
        recipientId: booking.driverId,
        senderId: clientId,
        type: "PAYMENT",
        title: `${clientNameOf(booking.client)} says your salary is paid`,
        message: `${formatMoney(row.amount_minor, row.currency)} for ${periodLabel(row)}. Confirm you received it, or tell us if you didn't.`,
        actionUrl: `/dashboard/job-request/${booking.reference}`,
        metadata: { reference: booking.reference, salaryPaymentId: row.id },
      });
    }

    return serializeSalary(updated, now);
  }

  async confirm(driverId: string, reference: string, id: string) {
    const booking = await this.driverBooking(driverId, reference);
    const row = await this.ownRow(booking, id);

    if (!["DUE", "PAID"].includes(row.status)) throw new BadRequestError(row.status === "CONFIRMED" ? "You've already confirmed this salary" : "This salary is under review by our team");

    const now = new Date();
    const updated = await this.salaryRepo.update(row.id, { status: "CONFIRMED", confirmed_at: now, paid_at: row.paid_at ?? now });

    await this.notificationService.notify({
      recipientId: booking.clientId,
      senderId: driverId,
      type: "SUCCESS",
      title: `${nameOf(booking.driver)} confirmed their salary`,
      message: `${formatMoney(row.amount_minor, row.currency)} for ${periodLabel(row)} is confirmed as received.`,
      actionUrl: `/dashboard/my-hire/${booking.reference}`,
      metadata: { reference: booking.reference, salaryPaymentId: row.id },
    });

    return serializeSalary(updated, now);
  }

  async dispute(driverId: string, reference: string, id: string, reason: string) {
    const booking = await this.driverBooking(driverId, reference);
    const row = await this.ownRow(booking, id);
    const now = new Date();

    if (row.status !== "PAID" && !isOverdue(row, now)) {
      throw new BadRequestError(row.status === "DUE" ? "This salary isn't overdue yet - you can report it once it is" : "This salary can't be disputed");
    }

    const updated = await this.salaryRepo.update(row.id, { status: "DISPUTED", disputed_at: now, dispute_reason: reason, resolution: null, resolution_note: null, resolved_at: null, resolved_by: null });

    const driverName = nameOf(booking.driver);
    const clientName = clientNameOf(booking.client);
    const adminIds = await this.userRepo.findAdminIds();

    await Promise.all([
      ...adminIds.map(recipientId =>
        this.notificationService.notify({
          recipientId,
          senderId: driverId,
          type: "WARNING",
          title: "Salary disputed",
          message: `${driverName} says ${clientName} hasn't paid ${formatMoney(row.amount_minor, row.currency)} for ${periodLabel(row)} (${booking.reference}): "${reason}"`,
          actionUrl: "/dashboard/salaries",
          metadata: { reference: booking.reference, salaryPaymentId: row.id },
        }),
      ),
      this.notificationService.notify({
        recipientId: booking.clientId,
        senderId: driverId,
        type: "WARNING",
        title: `${driverName} reported a salary as unpaid`,
        message: `${periodLabel(row)} on ${booking.reference}: "${reason}". Our team will be in touch - reply through Support if you have a receipt.`,
        actionUrl: `/dashboard/my-hire/${booking.reference}`,
        metadata: { reference: booking.reference, salaryPaymentId: row.id },
      }),
    ]);

    return serializeSalary(updated, now);
  }

  async adminList(filter: AdminSalaryFilter, query: Record<string, unknown>) {
    const now = new Date();
    const pagination = parsePagination(query);
    const [{ rows, total }, counts] = await Promise.all([
      this.salaryRepo.findForAdmin(filter, overdueCutoff(now), pagination),
      this.salaryRepo.countForAdmin(overdueCutoff(now)),
    ]);

    return { ...paginate(rows.map(row => salaryWithParties(row, now)), total, pagination), counts };
  }

  async adminCounts() {
    return this.salaryRepo.countForAdmin(overdueCutoff());
  }

  async resolve(adminId: string, id: string, outcome: "PAID" | "UNPAID", note: string) {
    const row = await this.salaryRepo.findById(id);

    if (!row) throw new NotFoundError("That salary payment was not found");
    if (row.status !== "DISPUTED") throw new BadRequestError("Only a disputed salary can be resolved");

    const now = new Date();
    const paid = outcome === "PAID";

    const updated = await this.salaryRepo.update(row.id, {
      ...(paid
        ? { status: "CONFIRMED", confirmed_at: now, paid_at: row.paid_at ?? now }
        : { status: "DUE", paid_at: null, receipt_url: null, client_note: null, last_reminded_at: null }),
      resolution: outcome,
      resolution_note: note,
      resolved_at: now,
      resolved_by: adminId,
    });

    const label = `${periodLabel(row)} on ${row.booking.reference}`;

    await Promise.all([
      this.notificationService.notify({
        recipientId: row.clientId,
        senderId: adminId,
        type: paid ? "INFO" : "WARNING",
        title: paid ? "Salary dispute closed - payment confirmed" : "Salary dispute upheld - payment still due",
        message: paid ? `We confirmed your payment for ${label}. ${note}` : `We couldn't confirm a payment for ${label}, so it's due again. ${note}`,
        actionUrl: `/dashboard/my-hire/${row.booking.reference}`,
        metadata: { reference: row.booking.reference, salaryPaymentId: row.id },
      }),
      this.notificationService.notify({
        recipientId: row.driverId,
        senderId: adminId,
        type: paid ? "INFO" : "SUCCESS",
        title: paid ? "We closed your salary dispute" : "We upheld your salary dispute",
        message: paid ? `We found the client paid ${label}, so it's recorded as received. ${note}` : `${label} is due again and the client has been told. ${note}`,
        actionUrl: `/dashboard/job-request/${row.booking.reference}`,
        metadata: { reference: row.booking.reference, salaryPaymentId: row.id },
      }),
    ]);

    return salaryWithParties(updated, now);
  }

  async remindOverdue() {
    const now = new Date();
    const rows = await this.salaryRepo.findOverdueToRemind(overdueCutoff(now), new Date(now.getTime() - SALARY_REMINDER_EVERY_DAYS * DAY_MS));

    for (const row of rows) {
      const driverName = nameOf(row.booking.driver);
      const amount = formatMoney(row.amount_minor, row.currency);

      await this.notificationService.notify({
        recipientId: row.clientId,
        type: "PAYMENT",
        title: `${driverName}'s salary is overdue`,
        message: `${amount} for ${periodLabel(row)} was due on ${day(row.due_at)}. Pay ${driverName} directly, then mark it as paid on the hire.`,
        actionUrl: `/dashboard/my-hire/${row.booking.reference}`,
        metadata: { reference: row.booking.reference, salaryPaymentId: row.id },
      });

      if (!row.last_reminded_at) {
        await this.notificationService.notify({
          recipientId: row.driverId,
          type: "INFO",
          title: "We've reminded the client about your salary",
          message: `${amount} for ${periodLabel(row)} is overdue. If you've been paid, confirm it on the job; if not, you can report it to us there.`,
          actionUrl: `/dashboard/job-request/${row.booking.reference}`,
          metadata: { reference: row.booking.reference, salaryPaymentId: row.id },
        });
      }
    }

    await this.salaryRepo.markReminded(
      rows.map(row => row.id),
      now,
    );

    return rows.length;
  }

  private async list(booking: Booking) {
    await this.sync(booking);

    const now = new Date();
    const rows = (await this.salaryRepo.findForBooking(booking.id)).map(row => serializeSalary(row, now));

    return {
      engagement_type: booking.engagement_type,
      amount_minor: booking.amount,
      currency: booking.currency,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      grace_days: SALARY_GRACE_DAYS,
      summary: {
        confirmed_minor: rows.filter(row => row.status === "CONFIRMED").reduce((sum, row) => sum + row.amount_minor, 0),
        outstanding_minor: rows.filter(row => row.status === "DUE").reduce((sum, row) => sum + row.amount_minor, 0),
        overdue_count: rows.filter(row => row.overdue).length,
        awaiting_confirmation: rows.filter(row => row.status === "PAID").length,
        disputed: rows.filter(row => row.status === "DISPUTED").length,
      },
      payments: rows,
    };
  }

  private async ownRow(booking: Booking, id: string) {
    const row = await this.salaryRepo.findById(id);

    if (!row || row.bookingId !== booking.id) throw new NotFoundError("That salary payment was not found");

    return row;
  }

  private async driverBooking(driverId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.driverId !== driverId) throw new ForbiddenError("That booking belongs to another driver");

    return booking;
  }

  private async clientBooking(clientId: string, reference: string) {
    const booking = await this.bookingRepo.findByReference(reference);

    if (!booking) throw new NotFoundError("Hire not found");
    if (booking.clientId !== clientId) throw new ForbiddenError("That hire belongs to another client");

    return booking;
  }
}
