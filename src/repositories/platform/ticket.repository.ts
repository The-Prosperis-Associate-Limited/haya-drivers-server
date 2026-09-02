import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export class TicketRepository {
  async create(data: Prisma.TicketUncheckedCreateInput) {
    return prisma.ticket.create({ data });
  }

  // Notification action urls carry the reference, the UI carries the id, so the
  // lookup accepts either rather than 404ing on a link we sent ourselves.
  async findByIdOrReference(idOrReference: string) {
    return prisma.ticket.findFirst({
      where: { OR: [{ id: idOrReference }, { reference: idOrReference }] },
      include: {
        creator: { select: { id: true, first_name: true, last_name: true, email: true, role: true } },
        assignee: { select: { id: true, first_name: true, last_name: true } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, first_name: true, last_name: true, role: true } } } },
      },
    });
  }

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, first_name: true, last_name: true, email: true, role: true } },
        assignee: { select: { id: true, first_name: true, last_name: true } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, first_name: true, last_name: true, role: true } } } },
      },
    });
  }

  async findByReference(reference: string) {
    return prisma.ticket.findUnique({ where: { reference } });
  }

  async update(id: string, data: Prisma.TicketUncheckedUpdateInput) {
    return prisma.ticket.update({ where: { id }, data });
  }

  async findForCreator(creatorId: string, params: { page: number; limit: number; status?: $Enums.TicketStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = { creatorId, ...(status && { status }) };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.ticket.count({ where }),
    ]);

    return { tickets, total };
  }

  async findAll(params: { page: number; limit: number; status?: $Enums.TicketStatus; priority?: $Enums.TicketPriority; search?: string }) {
    const { page, limit, status, priority, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(search && { OR: [{ subject: { contains: search, mode: "insensitive" } }, { reference: { contains: search, mode: "insensitive" } }] }),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { creator: { select: { id: true, first_name: true, last_name: true, email: true, role: true } } },
      }),
      prisma.ticket.count({ where }),
    ]);

    return { tickets, total };
  }

  async addComment(data: Prisma.TicketCommentUncheckedCreateInput) {
    return prisma.ticketComment.create({ data });
  }

  // Internal notes are staff-only; the driver never sees them on their ticket.
  async findComments(ticketId: string, includeInternal: boolean) {
    return prisma.ticketComment.findMany({
      where: { ticketId, ...(includeInternal ? {} : { is_internal: false }) },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, first_name: true, last_name: true, role: true } } },
    });
  }
}
