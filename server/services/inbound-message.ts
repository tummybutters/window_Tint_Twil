import type { InsertConversation } from "@shared/schema";
import { storage } from "../storage";
import { getOrCreateConversation } from "../twilio";
import { registry } from "../core/registry";

interface InboundMessageInput {
  phone: string;
  text?: string | null;
  conversationSid?: string | null;
  mediaUrl?: string;
  mediaType?: string;
  externalId?: string | null;
  source?: string | null;
}

export async function handleInboundMessage({
  phone,
  text,
  conversationSid,
  mediaUrl,
  mediaType,
  externalId,
  source,
}: InboundMessageInput): Promise<void> {
  const messageText = text || "";
  const lastMessage = messageText || (mediaUrl ? "[Image]" : "");
  const normalizedSource = source || "unknown";

  if (externalId) {
    const existing = await storage.getMessageByExternalId(normalizedSource, externalId);
    if (existing) {
      console.log(`Skipping duplicate inbound message (${normalizedSource}:${externalId})`);
      return;
    }
  }

  const now = new Date();

  // 1. Core Logic: Upsert Conversation
  const insertValues: InsertConversation = {
    phone,
    name: null,
    lastMessage,
    lastActivity: now,
    needsReply: true,
    ...(conversationSid ? { conversationSid } : {}),
  };
  const updateValues: Partial<InsertConversation> = {
    lastMessage,
    lastActivity: now,
    needsReply: true,
    ...(conversationSid ? { conversationSid } : {}),
  };

  let conversation = await storage.upsertConversationByPhone(
    insertValues,
    updateValues,
  );
  const isNewConversation = false; // TODO: Check if conversation was just created using createdAt if available in schema

  // 2. Core Logic: Save Message
  const createdMessage = await storage.createMessage({
    conversationId: conversation.id,
    text: messageText,
    timestamp: new Date(),
    direction: "inbound",
    status: "sent", // Inbound messages are "sent" by the user
    mediaUrl,
    mediaType,
    externalId: externalId || null,
    source: normalizedSource,
  });

  // 3. Ensure Twilio Conversation exists (Platform requirement)
  let activeConversationSid = conversationSid || conversation.conversationSid;
  if (!activeConversationSid) {
    try {
      const twilioConversation = await getOrCreateConversation(phone);
      activeConversationSid = twilioConversation.sid;
      conversation = await storage.updateConversation(phone, {
        conversationSid: activeConversationSid,
      });
    } catch (error) {
      console.error("Failed to create Twilio conversation:", error);
    }
  }

  // 4. Delegate to Agents (The "Vibe Coded" Parts)
  // This loop iterates through all registered agents (Assessment, Workflow, Responder, etc.)
  // and lets them react to the new message.
  await registry.dispatchMessage({
    message: createdMessage,
    conversation,
    isNewConversation
  });
}
