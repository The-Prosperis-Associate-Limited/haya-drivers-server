import type { $Enums } from "../../generated/prisma/client";
import { TicketRepository } from "../../repositories/platform/ticket.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { NotificationService } from "./notification.service";
import type { CreateTicketInput, TicketCommentInput } from "../../utils/types/ticketValidatorSchema";

const { CLIENT_URL } = process.env;

export class TicketService {
  private ticketRepo = new TicketRepository();
  private userRepo = new UserRepository();
  private notificationService = new NotificationService();

  async create(creatorId: string, data: CreateTicketInput) {
    const ticket = await this.ticketRepo.create({ ...data, creatorId, reference: generateReference("TKT") });

    const user = await this.userRepo.findById(creatorId, { email: true, first_name: true });

    await queueEmail(JOB_KEY.CREATE_TICKET, {
      email: user?.email as string,
      first_name: (user?.first_name as string) ?? "there",
      subject_line: ticket.subject,
      reference: ticket.reference,
      baseUrl: CLIENT_URL as string,
    });

    return ticket;
  }

  async listForUser(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { tickets, total } = await this.ticketRepo.findForCreator(userId, { ...pagination, status: query.status as $Enums.TicketStatus | undefined });

    return paginate(tickets, total, pagination);
  }

  async listAll(query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { tickets, total } = await this.ticketRepo.findAll({
      ...pagination,
      status: query.status as $Enums.TicketStatus | undefined,
      priority: query.priority as $Enums.TicketPriority | undefined,
      search: query.search as string | undefined,
    });

    return paginate(tickets, total, pagination);
  }

  async get(idOrReference: string, requesterId: string, role: string) {
    const ticket = await this.ticketRepo.findByIdOrReference(idOrReference);

    if (!ticket) throw new NotFoundError("Ticket not found");

    const isOwner = ticket.creatorId === requesterId;

    if (!isOwner && role !== "ADMIN") throw new ForbiddenError("That ticket belongs to someone else");

    return { ...ticket, comments: await this.ticketRepo.findComments(ticket.id, role === "ADMIN") };
  }

  async comment(idOrReference: string, authorId: string, role: string, data: TicketCommentInput) {
    const ticket = await this.ticketRepo.findByIdOrReference(idOrReference);

    if (!ticket) throw new NotFoundError("Ticket not found");
    if (ticket.creatorId !== authorId && role !== "ADMIN") throw new ForbiddenError("That ticket belongs to someone else");

    // Only staff can write an internal note; a driver flagging their own comment
    // internal would hide it from the person meant to read it.
    const is_internal = role === "ADMIN" ? data.is_internal : false;

    const comment = await this.ticketRepo.addComment({ ticketId: ticket.id, authorId, message: data.message, is_internal });

    if (!is_internal && ticket.creatorId !== authorId) {
      await this.notificationService.notify({
        recipientId: ticket.creatorId,
        senderId: authorId,
        type: "MESSAGE",
        title: "Reply on your ticket",
        message: data.message.slice(0, 140),
        actionUrl: `/dashboard/support/${ticket.reference}`,
      });
    }

    return comment;
  }

  async updateStatus(id: string, data: { status?: $Enums.TicketStatus; priority?: $Enums.TicketPriority; assigneeId?: string }) {
    const ticket = await this.ticketRepo.findById(id);

    if (!ticket) throw new NotFoundError("Ticket not found");

    const updated = await this.ticketRepo.update(id, {
      ...data,
      ...(data.status === "RESOLVED" && { resolved_at: new Date() }),
    });

    if (data.status) {
      await queueEmail(JOB_KEY.UPDATE_TICKET, {
        email: ticket.creator.email,
        first_name: ticket.creator.first_name ?? "there",
        subject_line: ticket.subject,
        reference: ticket.reference,
        status: data.status,
        message: "Open the ticket to see the latest reply.",
        baseUrl: CLIENT_URL as string,
      });
    }

    return updated;
  }
}
