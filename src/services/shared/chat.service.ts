import { ConversationRepository } from "../../repositories/platform/conversation.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotificationService } from "./notification.service";
import { getSocketIO, notifySupportPool } from "../../helper/socket";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import type { $Enums } from "../../generated/prisma/client";

/*
  Support chat: one open conversation per user. WAITING means no admin has
  joined yet; joining flips it to ACTIVE. Everything is delivered over REST
  writes + socket echoes — the socket is never a write path.
*/
export class ChatService {
  private conversationRepo = new ConversationRepository();
  private userRepo = new UserRepository();
  private notificationService = new NotificationService();

  private emitToConversation(participantIds: string[], event: string, payload: unknown) {
    const io = getSocketIO();
    for (const userId of new Set(participantIds)) io.to(userId).emit(event, payload);
  }

  async getConversation(userId: string) {
    const conversation = await this.conversationRepo.findOpenForUser(userId);

    if (!conversation) return { conversation: null, unread: 0 };

    const unread = await this.conversationRepo.countUnread(conversation.id, userId);

    return { conversation, unread };
  }

  async sendUserMessage(userId: string, role: $Enums.UserRole, text: string) {
    if (role === "ADMIN") throw new ForbiddenError("Admins reply from the support inbox");

    let conversation = await this.conversationRepo.findOpenForUser(userId);
    const isNew = !conversation;

    if (!conversation) conversation = await this.conversationRepo.create(userId);

    const message = await this.conversationRepo.appendMessage(conversation.id, { senderId: userId, message: text });

    await this.conversationRepo.markRead(conversation.id, userId);

    const participantIds = conversation.participants.map(entry => entry.userId);
    this.emitToConversation(participantIds, "new-message", { conversationId: conversation.id, message });

    // Admins watch the pool, not individual rooms, until they join.
    notifySupportPool({
      kind: isNew ? "new-conversation" : "new-message",
      conversationId: conversation.id,
      preview: text.slice(0, 200),
    });

    return { conversationId: conversation.id, message };
  }

  async markRead(conversationId: string, userId: string) {
    await this.conversationRepo.markRead(conversationId, userId);

    return { ok: true };
  }

  async listInbox(query: { page: number; limit: number; status?: $Enums.ConversationStatus }) {
    const { conversations, total } = await this.conversationRepo.listInbox(query);

    return {
      data: conversations,
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async getConversationForAdmin(conversationId: string, adminId: string) {
    const conversation = await this.requireConversation(conversationId);

    const unread = await this.conversationRepo.countUnread(conversationId, adminId);

    return { conversation, unread };
  }

  async joinConversation(conversationId: string, adminId: string) {
    const conversation = await this.requireConversation(conversationId);

    if (conversation.status === "RESOLVED") throw new ForbiddenError("This conversation is already resolved");

    await this.conversationRepo.upsertParticipant(conversationId, adminId);
    await this.conversationRepo.updateStatus(conversationId, "ACTIVE");

    const admin = await this.userRepo.findById(adminId, { first_name: true });
    const name = (admin?.first_name as string) ?? "An agent";

    const notice = await this.conversationRepo.appendMessage(conversationId, {
      message: `${name} from support has joined the chat`,
      is_system: true,
    });

    const participantIds = [...conversation.participants.map(entry => entry.userId), adminId];
    this.emitToConversation(participantIds, "new-message", { conversationId, message: notice });
    notifySupportPool({ kind: "conversation-claimed", conversationId });

    await this.notificationService.notify({
      recipientId: conversation.initiatedById,
      type: "MESSAGE",
      title: "Support joined your chat",
      message: `${name} from support has joined your conversation.`,
    });

    return this.conversationRepo.findByIdWithMessages(conversationId);
  }

  async sendAdminMessage(conversationId: string, adminId: string, text: string) {
    const conversation = await this.requireConversation(conversationId);

    if (conversation.status === "RESOLVED") throw new ForbiddenError("This conversation is already resolved");

    const isParticipant = conversation.participants.some(entry => entry.userId === adminId);

    if (!isParticipant) throw new ForbiddenError("Join the conversation before replying");

    const message = await this.conversationRepo.appendMessage(conversationId, { senderId: adminId, message: text });

    await this.conversationRepo.markRead(conversationId, adminId);

    const participantIds = conversation.participants.map(entry => entry.userId);
    this.emitToConversation(participantIds, "new-message", { conversationId, message });

    await this.notificationService.notify({
      recipientId: conversation.initiatedById,
      senderId: adminId,
      type: "MESSAGE",
      title: "Support replied",
      message: text.slice(0, 140),
    });

    return message;
  }

  async resolveConversation(conversationId: string, adminId: string) {
    const conversation = await this.requireConversation(conversationId);

    if (conversation.status === "RESOLVED") return conversation;

    await this.conversationRepo.updateStatus(conversationId, "RESOLVED");

    const notice = await this.conversationRepo.appendMessage(conversationId, {
      message: "This conversation was marked as resolved. Send a new message any time to start another.",
      is_system: true,
    });

    const participantIds = [...conversation.participants.map(entry => entry.userId), adminId];
    this.emitToConversation(participantIds, "new-message", { conversationId, message: notice });
    this.emitToConversation(participantIds, "chat-resolved", { conversationId });
    notifySupportPool({ kind: "conversation-resolved", conversationId });

    return this.conversationRepo.findByIdWithMessages(conversationId);
  }

  private async requireConversation(conversationId: string) {
    const conversation = await this.conversationRepo.findByIdWithMessages(conversationId);

    if (!conversation) throw new NotFoundError("That conversation was not found");

    return conversation;
  }
}
