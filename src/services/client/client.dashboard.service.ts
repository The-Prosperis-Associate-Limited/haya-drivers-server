import { prisma } from "../../helper/prisma";

export class ClientDashboardService {
  // "In request list" counts a marketplace request list that does not exist yet;
  // it stays 0 until that feature lands so the card is never a lie.
  async stats(clientId: string) {
    const [activeDrivers, openRequests] = await Promise.all([
      prisma.booking.findMany({
        where: { clientId, status: { in: ["ACCEPTED", "IN_PROGRESS"] }, driverId: { not: null } },
        select: { driverId: true },
        distinct: ["driverId"],
      }),
      prisma.booking.count({ where: { clientId, status: "REQUESTED" } }),
    ]);

    return {
      active_drivers: activeDrivers.length,
      open_requests: openRequests,
      request_list: 0,
    };
  }
}
