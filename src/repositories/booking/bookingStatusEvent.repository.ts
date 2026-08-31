import type { $Enums } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class BookingStatusEventRepository {
  async create(data: { bookingId: string; from_status?: $Enums.BookingStatus | null; to_status: $Enums.BookingStatus; changed_by?: string; note?: string }) {
    return prisma.bookingStatusEvent.create({ data });
  }

  async findForBooking(bookingId: string) {
    return prisma.bookingStatusEvent.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
  }
}
