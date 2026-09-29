import { prisma } from "../../helper/prisma";
import { BookingRepository } from "../../repositories/booking/booking.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { WalletTransactionRepository } from "../../repositories/earnings/walletTransaction.repository";

export class ClientDashboardService {
  private bookingRepo = new BookingRepository();
  private walletRepo = new WalletRepository();
  private transactionRepo = new WalletTransactionRepository();

  // "In request list" is the applicants waiting across the client's open
  // staffing requests - 0 until driver apply ships, but counted, never assumed.
  async stats(clientId: string) {
    const [activeDrivers, openRequests, requestList] = await Promise.all([
      prisma.booking.findMany({
        where: { clientId, status: { in: ["ACCEPTED", "IN_PROGRESS"] }, driverId: { not: null } },
        select: { driverId: true },
        distinct: ["driverId"],
      }),
      prisma.booking.count({ where: { clientId, status: "REQUESTED" } }),
      prisma.requestApplication.count({
        where: { status: { in: ["APPLIED", "SHORTLISTED"] }, request: { clientId, status: "OPEN" } },
      }),
    ]);

    return {
      active_drivers: activeDrivers.length,
      open_requests: openRequests,
      request_list: requestList,
    };
  }

  /*
    One payload for the overview screen. Monthly spend is what actually left the
    wallet this month; the delta is against last month and null when there is no
    last month to compare against - a delta against zero is theatre.
  */
  async overview(clientId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const wallet = await this.walletRepo.ensureForUser(clientId);

    const [stats, hires, openRequests, recentPayments, spendThisMonth, spendUpToNow] = await Promise.all([
      this.stats(clientId),
      this.bookingRepo.findActiveHires(clientId, { page: 1, limit: 4 }),
      prisma.booking.findMany({
        where: { clientId, status: "REQUESTED" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          reference: true,
          title: true,
          driver_type: true,
          createdAt: true,
          driver: { select: { first_name: true, last_name: true } },
        },
      }),
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id, type: "BOOKING_CHARGE" },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { booking: { select: { reference: true, driver: { select: { first_name: true, last_name: true } } } } },
      }),
      this.transactionRepo.sumDebitsByType(wallet.id, "BOOKING_CHARGE", monthStart),
      this.transactionRepo.sumDebitsByType(wallet.id, "BOOKING_CHARGE", lastMonthStart),
    ]);

    const spendLastMonth = spendUpToNow - spendThisMonth;

    return {
      stats: {
        ...stats,
        monthly_spend_minor: spendThisMonth,
        spend_delta_percent: spendLastMonth > 0 ? Math.round(((spendThisMonth - spendLastMonth) / spendLastMonth) * 100) : null,
      },
      hired_staff: hires.bookings,
      open_requests: openRequests,
      recent_payments: recentPayments,
      currency: wallet.currency,
    };
  }
}
