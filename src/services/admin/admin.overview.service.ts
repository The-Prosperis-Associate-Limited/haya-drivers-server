import type { $Enums } from "../../generated/prisma/client";
import { SalaryService } from "../booking/salary.service";
import { prisma } from "../../helper/prisma";
import { getSocketIO } from "../../helper/socket";

export const OVERVIEW_PERIODS = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type OverviewPeriod = keyof typeof OVERVIEW_PERIODS;

const DAY_MS = 24 * 60 * 60 * 1000;
const NEEDS_ACTION_LIMIT = 8;

type Stage = "NEW" | "SHORTLISTING" | "TRIM" | "READY" | "PAYMENT";

// An escalated chat nobody from the team has joined yet - the AI has gone quiet and the client is waiting on a human.
const WAITING_CHAT = { status: "ACTIVE" as const, participants: { none: { user: { role: "ADMIN" as const } } } };

const nameOf = (person: { first_name: string | null; last_name: string | null } | null, fallback: string) =>
  [person?.first_name, person?.last_name].filter(Boolean).join(" ") || fallback;

const delta = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

const stageOf = (request: { status: $Enums.HireRequestStatus; drivers_needed: number; assignments: { status: $Enums.AvailabilityStatus }[] }): Stage => {
  if (request.status === "PAYMENT_REVIEW") return "PAYMENT";
  if (!request.assignments.length) return "NEW";

  const confirmed = request.assignments.filter(assignment => assignment.status === "CONFIRMED").length;

  if (confirmed < request.drivers_needed) return "SHORTLISTING";
  return request.assignments.length > request.drivers_needed ? "TRIM" : "READY";
};

export class AdminOverviewService {
  // Sidebar counts and who's on shift - polled by the admin shell on every page, so it stays to counts.
  async nav() {
    const [pendingVerifications, hiresNeedingAction, payoutsNeedingAction, openFlags, chatsWaiting, team, salaries] = await Promise.all([
      prisma.driverProfile.count({ where: { verification_status: "PENDING" } }),
      prisma.hireRequest.count({ where: { status: { in: ["PENDING_REVIEW", "PAYMENT_REVIEW"] } } }),
      prisma.payout.count({ where: { status: { in: ["REQUESTED", "FAILED"] } } }),
      prisma.attendance.count({ where: { flagged_at: { not: null }, flag_resolved_at: null } }),
      prisma.conversation.count({ where: WAITING_CHAT }),
      this.onlineAdmins(),
      new SalaryService().adminCounts(),
    ]);

    return {
      counts: {
        drivers: pendingVerifications,
        hires: hiresNeedingAction,
        transactions: payoutsNeedingAction,
        attendance: openFlags,
        support: chatsWaiting,
        salaries: salaries.disputed + salaries.overdue,
      },
      team,
      chats_waiting: chatsWaiting,
    };
  }

  async overview(period: OverviewPeriod) {
    const now = new Date();
    const days = OVERVIEW_PERIODS[period];
    const since = new Date(now.getTime() - days * DAY_MS);
    const previousSince = new Date(since.getTime() - days * DAY_MS);
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    const [
      pendingVerifications,
      chatsWaiting,
      totalUsers,
      newUsers,
      previousNewUsers,
      activeDrivers,
      approvedInPeriod,
      reviewQueue,
      invoicedCount,
      activeHires,
      paidInPeriod,
      paidPreviousPeriod,
      shortlistTimes,
      paidSeries,
    ] = await Promise.all([
      prisma.driverProfile.count({ where: { verification_status: "PENDING" } }),
      prisma.conversation.count({ where: WAITING_CHAT }),
      prisma.user.count({ where: { role: { in: ["DRIVER", "CLIENT"] }, anonymised_at: null } }),
      prisma.user.count({ where: { role: { in: ["DRIVER", "CLIENT"] }, createdAt: { gte: since } } }),
      prisma.user.count({ where: { role: { in: ["DRIVER", "CLIENT"] }, createdAt: { gte: previousSince, lt: since } } }),
      prisma.driverProfile.count({ where: { verification_status: "APPROVED" } }),
      prisma.activity.count({ where: { type: "VERIFICATION_APPROVED", createdAt: { gte: since } } }),
      prisma.hireRequest.findMany({
        where: { status: { in: ["PENDING_REVIEW", "PAYMENT_REVIEW"] } },
        select: {
          id: true,
          reference: true,
          status: true,
          drivers_needed: true,
          driver_type: true,
          engagement_type: true,
          state: true,
          nearest_area: true,
          createdAt: true,
          assignments: { select: { status: true, expired_at: true } },
          invoice: { select: { proof_submitted_at: true, total_minor: true, currency: true } },
          client: { select: { id: true, first_name: true, last_name: true, profile_pic: true, client_profile: { select: { organisation_name: true } } } },
        },
      }),
      prisma.hireRequest.count({ where: { status: "INVOICED" } }),
      prisma.booking.count({ where: { status: { in: ["ACCEPTED", "IN_PROGRESS"] }, engagement_type: { in: ["MONTHLY", "CONTRACT"] } } }),
      prisma.hireInvoice.aggregate({ where: { status: "PAID", paid_at: { gte: since } }, _sum: { total_minor: true, fee_minor: true } }),
      prisma.hireInvoice.aggregate({ where: { status: "PAID", paid_at: { gte: previousSince, lt: since } }, _sum: { total_minor: true } }),
      prisma.hireRequest.findMany({
        where: { createdAt: { gte: since }, assignments: { some: {} } },
        select: { createdAt: true, assignments: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 } },
      }),
      prisma.hireInvoice.findMany({ where: { status: "PAID", paid_at: { gte: sixMonthsAgo } }, select: { paid_at: true, total_minor: true } }),
    ]);

    const staged = reviewQueue.map(request => {
      const stage = stageOf(request);
      const waitingSince = stage === "PAYMENT" ? (request.invoice?.proof_submitted_at ?? request.createdAt) : request.createdAt;

      return {
        reference: request.reference,
        stage,
        drivers_needed: request.drivers_needed,
        driver_type: request.driver_type,
        engagement_type: request.engagement_type,
        area: [request.nearest_area, request.state].filter(Boolean).join(", ") || null,
        shortlist: {
          confirmed: request.assignments.filter(assignment => assignment.status === "CONFIRMED").length,
          pending: request.assignments.filter(assignment => assignment.status === "PENDING").length,
          declined: request.assignments.filter(assignment => assignment.status === "DECLINED").length,
          total: request.assignments.length,
        },
        invoice_total_minor: request.invoice?.total_minor ?? null,
        currency: request.invoice?.currency ?? "NGN",
        waiting_since: waitingSince,
        client: {
          id: request.client.id,
          name: request.client.client_profile?.organisation_name || nameOf(request.client, "Client"),
          profile_pic: request.client.profile_pic,
        },
      };
    });

    const count = (...stages: Stage[]) => staged.filter(request => stages.includes(request.stage)).length;

    const hours = shortlistTimes
      .filter(request => request.assignments[0])
      .map(request => (request.assignments[0].createdAt.getTime() - request.createdAt.getTime()) / 3_600_000);

    const months = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
      return { month: start.toISOString().slice(0, 7), total_minor: 0 };
    });
    for (const invoice of paidSeries) {
      const bucket = months.find(month => month.month === invoice.paid_at?.toISOString().slice(0, 7));
      if (bucket) bucket.total_minor += invoice.total_minor;
    }

    const paidNow = paidInPeriod._sum.total_minor ?? 0;
    const paidBefore = paidPreviousPeriod._sum.total_minor ?? 0;

    return {
      period,
      tiles: {
        pending_verifications: pendingVerifications,
        payment_reviews: count("PAYMENT"),
        ready_to_invoice: count("TRIM", "READY"),
        chats_waiting: chatsWaiting,
      },
      stats: {
        total_users: totalUsers,
        new_users: newUsers,
        new_users_delta_percent: delta(newUsers, previousNewUsers),
        active_drivers: activeDrivers,
        approved_in_period: approvedInPeriod,
        open_hire_requests: staged.length + invoicedCount,
        avg_hours_to_shortlist: hours.length ? Math.round(hours.reduce((sum, value) => sum + value, 0) / hours.length) : null,
        invoices_paid_minor: paidNow,
        invoices_paid_delta_percent: delta(paidNow, paidBefore),
        fees_minor: paidInPeriod._sum.fee_minor ?? 0,
        currency: "NGN",
      },
      pipeline: {
        new: count("NEW"),
        shortlisting: count("SHORTLISTING"),
        ready_to_invoice: count("TRIM", "READY"),
        invoiced: invoicedCount,
        payment_review: count("PAYMENT"),
        active_hires: activeHires,
      },
      needs_action: staged.sort((a, b) => a.waiting_since.getTime() - b.waiting_since.getTime()).slice(0, NEEDS_ACTION_LIMIT),
      needs_action_total: staged.length,
      invoices_paid_series: months,
    };
  }

  // Admins join the support-pool room when their console opens a socket, so the room is who's on shift right now.
  private async onlineAdmins() {
    let ids: string[] = [];

    try {
      const sockets = await getSocketIO().in("support-pool").fetchSockets();
      ids = [...new Set(sockets.map(socket => socket.data.userId as string).filter(Boolean))];
    } catch {
      return [];
    }

    if (!ids.length) return [];

    const admins = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, first_name: true, last_name: true, profile_pic: true, admin_profile: { select: { admin_role: true } } },
    });

    return admins.map(admin => ({ id: admin.id, name: nameOf(admin, "Admin"), profile_pic: admin.profile_pic, admin_role: admin.admin_profile?.admin_role ?? null }));
  }
}
