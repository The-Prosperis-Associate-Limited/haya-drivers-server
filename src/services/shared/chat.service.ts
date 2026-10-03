import { ConversationRepository } from "../../repositories/platform/conversation.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotificationService } from "./notification.service";
import { getSocketIO, notifySupportPool } from "../../helper/socket";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { generateText, AiUnavailableError } from "../../utils/ai";
import type { ChatTurn } from "../../utils/ai";
import { ESCALATE_TOKEN, SUPPORT_SYSTEM_PROMPT } from "../../utils/supportKnowledge";
import type { $Enums } from "../../generated/prisma/client";

/*
  Support chat: one open conversation per user. While WAITING the AI assistant
  answers from the knowledge base; a policy topic or an [ESCALATE] reply flips
  the conversation to ACTIVE and pings the support pool. Joining also flips to
  ACTIVE - either way the AI never speaks again on that thread. Everything is
  delivered over REST writes + socket echoes - the socket is never a write path.
*/

const AI_HISTORY_LIMIT = 40;

// Topics the AI must never answer: money already moving, account destruction,
// verification outcomes. These escalate regardless of what the model thinks.
const POLICY_ESCALATION_PATTERNS = [
  /\brefund\b/i,
  /\binvoice\b/i,
  /\bcharge[ds]?\b/i,
  /\btransfer(red)?\b/i,
  /\bproof\s+of\s+payment\b/i,
  /\bpayment\s+(proof|rejected|failed|not\s+confirmed)\b/i,
  /\bpayout\b/i,
  /\bdelete\s+(my\s+)?account\b/i,
  /\bclose\s+(my\s+)?account\b/i,
  /\bverification\s+(was\s+)?(rejected|denied|failed)\b/i,
  /\b(speak|talk|chat)\s+(to|with)\s+(a\s+)?(human|person|agent|someone)\b/i,
  /\bhuman\s+agent\b/i,
  /\breal\s+person\b/i,
];

const isPolicyEscalation = (message: string) => POLICY_ESCALATION_PATTERNS.some(pattern => pattern.test(message));

// Models emit markdown emphasis no matter how firmly told not to; the panels
// render plain text, so strip it rather than show literal asterisks.
const stripMarkdown = (text: string) =>
  text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=[\s.,!?]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");

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

    // Only admins ever join a conversation, so any second participant is one.
    const hasHumanAgent = conversation.participants.some(entry => entry.userId !== userId);

    if (hasHumanAgent || conversation.status !== "WAITING") {
      return { conversationId: conversation.id, message, aiReply: null };
    }

    if (isPolicyEscalation(text)) {
      const notice = await this.escalate(conversation.id, participantIds, "One of our support agents will join this chat shortly to help you with that.");
      return { conversationId: conversation.id, message, aiReply: notice };
    }

    const priorTurns: ChatTurn[] = conversation.messages
      .filter(entry => !entry.is_system)
      .slice(-AI_HISTORY_LIMIT)
      .map(entry => ({ role: entry.is_from_ai ? ("assistant" as const) : ("user" as const), content: entry.message }));

    const aiReply = await this.generateAiReply([...priorTurns, { role: "user", content: text }]);

    if (aiReply.escalate) {
      const notice = await this.escalate(conversation.id, participantIds, aiReply.text || "One of our support agents will join this chat shortly.");
      return { conversationId: conversation.id, message, aiReply: notice };
    }

    const aiMessage = await this.conversationRepo.appendMessage(conversation.id, { message: aiReply.text, is_from_ai: true });
    this.emitToConversation(participantIds, "new-message", { conversationId: conversation.id, message: aiMessage });

    return { conversationId: conversation.id, message, aiReply: aiMessage };
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

  private async generateAiReply(history: ChatTurn[]): Promise<{ text: string; escalate: boolean }> {
    try {
      const { text: raw } = await generateText(history, SUPPORT_SYSTEM_PROMPT);
      const text = stripMarkdown(raw);

      if (text.includes(ESCALATE_TOKEN)) {
        return { text: text.replace(ESCALATE_TOKEN, "").trim(), escalate: true };
      }
      return { text, escalate: false };
    } catch (error) {
      // AI down = silent handoff to a human, not a broken chat.
      if (!(error instanceof AiUnavailableError)) console.error("[chat] AI reply failed:", error);
      return { text: "One of our support agents will join this chat shortly.", escalate: true };
    }
  }

  private async escalate(conversationId: string, participantIds: string[], noticeText: string) {
    // ACTIVE from the moment of escalation - that is what keeps the AI silent
    // while the conversation waits for an agent to claim it.
    await this.conversationRepo.updateStatus(conversationId, "ACTIVE");

    const notice = await this.conversationRepo.appendMessage(conversationId, { message: noticeText, is_from_ai: true });
    this.emitToConversation(participantIds, "new-message", { conversationId, message: notice });

    notifySupportPool({
      kind: "chat-escalated",
      conversationId,
      preview: notice.message.slice(0, 200),
    });

    return notice;
  }
}
