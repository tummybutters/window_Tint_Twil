import { company } from "../config/company";
import { storage } from "../storage";
import { getOrCreateConversation, sendConversationMessage } from "../twilio";
import { markWorkflowOutbound } from "./workflow";

interface CallStatusInput {
  callerNumber: string;
  dialDurationSeconds: number;
}

export async function handleCallStatus({
  callerNumber,
  dialDurationSeconds,
}: CallStatusInput): Promise<void> {
  const isAnswered = dialDurationSeconds >= company.callHandling.minDurationSeconds;
  const messageText = isAnswered
    ? company.callHandling.answeredMessage
    : company.callHandling.missedMessage;

  const answeredCallAt = isAnswered ? new Date() : undefined;
  let conversation = await storage.getConversationByPhone(callerNumber);

  if (!conversation) {
    conversation = await storage.createConversation({
      phone: callerNumber,
      name: null,
      lastMessage: messageText,
      lastActivity: new Date(),
      aiEnabled: !isAnswered,
      callSuppressedAt: answeredCallAt,
      needsReply: false,
    });
  } else if (isAnswered) {
    conversation = await storage.updateConversation(callerNumber, {
      aiEnabled: false,
      callSuppressedAt: answeredCallAt,
      needsReply: false,
    });
  }

  const twilioConversation = await getOrCreateConversation(callerNumber);
  if (!conversation.conversationSid) {
    conversation = await storage.updateConversation(callerNumber, {
      conversationSid: twilioConversation.sid,
    });
  }

  const messageRecord = await storage.createMessage({
    conversationId: conversation.id,
    text: messageText,
    timestamp: new Date(),
    direction: "outbound",
    status: "sending",
    source: "call-followup",
  });

  try {
    await sendConversationMessage(twilioConversation.sid, messageText);
    await storage.updateMessageStatus(messageRecord.id, "sent");
    await storage.updateConversation(callerNumber, {
      lastMessage: messageText,
      lastActivity: new Date(),
      needsReply: false,
    });
    markWorkflowOutbound(conversation.id, messageText).catch((err) =>
      console.error("Failed to update workflow after call follow-up:", err),
    );
  } catch (sendError) {
    console.error("Failed to send follow-up message after voice call:", sendError);
    await storage.updateMessageStatus(messageRecord.id, "failed");
  }
}
