import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

const SENDER_SELECT = {
  select: { id: true, first_name: true, last_name: true, role: true, profile_pic: true },
};

export class ConversationRepository {
  async findOpenForUser(userId: string) {
    return prisma.conversation.findFirst({
      where: { initiatedById: userId, status: { in: ["WAITING", "ACTIVE"] } },
      include: {
        messages: { orderBy: { sent_at: "asc" }, include: { sender: SENDER_SELECT } },
        participants: true,
      },
    });
  }

  async findByIdWithMessages(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        initiatedBy: { select: { id: true, first_name: true, last_name: true, email: true, role: true, profile_pic: true } },
        messages: { orderBy: { sent_at: "asc" }, include: { sender: SENDER_SELECT } },
        participants: true,
      },
    });
  }

  async create(initiatedById: string) {
    return prisma.conversation.create({
      data: {
        initiatedById,
        participants: { create: { userId: initiatedById } },
      },
      include: {
        messages: { orderBy: { sent_at: "asc" }, include: { sender: SENDER_SELECT } },
        participants: true,
      },
    });
  }

  // Message insert and conversation preview move together or not at all.
  async appendMessage(conversationId: string, data: { senderId?: string | null; message: string; is_system?: boolean; is_from_ai?: boolean }) {
    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: { conversationId, senderId: data.senderId ?? null, message: data.message, is_system: data.is_system ?? false, is_from_ai: data.is_from_ai ?? false },
        include: { sender: SENDER_SELECT },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { last_message: data.message.slice(0, 200), last_updated: new Date() },
      }),
    ]);

    return message;
  }

  async updateStatus(id: string, status: $Enums.ConversationStatus) {
    return prisma.conversation.update({ where: { id }, data: { status } });
  }

  async upsertParticipant(conversationId: string, userId: string) {
    return prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId },
      update: {},
    });
  }

  async markRead(conversationId: string, userId: string) {
    return prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { last_read_at: new Date() },
    });
  }

  async countUnread(conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { last_read_at: true },
    });

    if (!participant) return 0;

    return prisma.chatMessage.count({
      where: {
        conversationId,
        sent_at: { gt: participant.last_read_at },
        OR: [{ senderId: { not: userId } }, { senderId: null }],
      },
    });
  }

  async listInbox(params: { page: number; limit: number; status?: $Enums.ConversationStatus }) {
    const { page, limit, status } = params;

    const where: Prisma.ConversationWhereInput = status ? { status } : { status: { in: ["WAITING", "ACTIVE"] } };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { last_updated: "desc" },
        include: {
          initiatedBy: { select: { id: true, first_name: true, last_name: true, email: true, role: true, profile_pic: true } },
          participants: true,
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return { conversations, total };
  }
}
