import { prisma } from "../../helper/prisma";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { ON_TIME_SAMPLE, onTimeRate } from "../../utils/onTimeRate";

export class ClientDashboardService {
  private bookingRepo = new BookingRepository();
  private hireRepo = new HireRequestRepository();

  // "In request list" is the applicants waiting across the client's open
  // staffing requests - 0 until driver apply ships, but counted, never assumed.
  async stats(clientId: string) {
    const [activeDrivers, openRequests, requestList] = await Promise.all([
      this.countActiveDrivers(clientId),
      this.hireRepo.countOpenForClient(clientId),
      prisma.requestApplication.count({
        where: { status: { in: ["APPLIED", "SHORTLISTED"] }, request: { clientId, status: "OPEN" } },
      }),
    ]);

    return {
      active_drivers: activeDrivers,
      open_requests: openRequests,
      request_list: requestList,
    };
  }

  /*
    One payload for the overview screen, read off the brokered hire rail: open
    requests are hire requests still short of PAID, spend is invoices the
    platform confirmed as paid (salaries go to drivers directly and are never
    recorded here), and the delta is null when there is no last month to
    compare against - a delta against zero is theatre. Months are UTC.
  */
  async overview(clientId: string) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    const [activeDrivers, openCount, hires, openRequests, invoiceDue, recentPayments, spendThisMonth, spendLastMonth, started] = await Promise.all([
      this.countActiveDrivers(clientId),
      this.hireRepo.countOpenForClient(clientId),
      this.bookingRepo.findActiveHires(clientId, { page: 1, limit: 4 }),
      this.hireRepo.listOpenForClient(clientId, 3),
      this.hireRepo.findInvoiceDueForClient(clientId),
      this.hireRepo.recentPaidInvoicesForClient(clientId, 4),
      this.hireRepo.sumPaidInvoicesForClient(clientId, monthStart),
      this.hireRepo.sumPaidInvoicesForClient(clientId, lastMonthStart, monthStart),
      this.bookingRepo.findStartedForClient(clientId, ON_TIME_SAMPLE),
    ]);

    return {
      stats: {
        active_drivers: activeDrivers,
        open_requests: openCount,
        monthly_spend_minor: spendThisMonth,
        spend_last_month_minor: spendLastMonth,
        spend_delta_percent: spendLastMonth > 0 ? Math.round(((spendThisMonth - spendLastMonth) / spendLastMonth) * 100) : null,
        on_time_rate: onTimeRate(started),
      },
      hired_staff: hires.bookings,
      hired_total: hires.total,
      hire_requests: openRequests.map(({ assignments, ...request }) => ({
        ...request,
        shortlist: {
          total: assignments.length,
          confirmed: assignments.filter(assignment => assignment.status === "CONFIRMED").length,
          pending: assignments.filter(assignment => assignment.status === "PENDING").length,
          declined: assignments.filter(assignment => assignment.status === "DECLINED").length,
        },
      })),
      invoice_due: invoiceDue,
      recent_payments: recentPayments,
      currency: invoiceDue?.invoice?.currency ?? recentPayments[0]?.currency ?? "NGN",
    };
  }

  private async countActiveDrivers(clientId: string) {
    const drivers = await prisma.booking.findMany({
      where: { clientId, status: { in: ["ACCEPTED", "IN_PROGRESS"] }, driverId: { not: null } },
      select: { driverId: true },
      distinct: ["driverId"],
    });

    return drivers.length;
  }
}
