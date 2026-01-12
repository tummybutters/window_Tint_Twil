import { storage } from "../storage";
import { analyzeLeadAssessment } from "../openai";
import { generateAIResponse } from "../ai-responder";
import { sendConversationMessage } from "../twilio";
import {
  buildBookingLinkForConversation,
  markWorkflowOutbound,
  type WorkflowContext,
} from "./workflow";
import { applyResponsePolicy } from "./response-policy";

// Track phones with assessments currently in progress to prevent duplicate API calls
const pendingAssessments = new Set<string>();

export function isAssessmentPending(phone: string): boolean {
  return pendingAssessments.has(phone);
}

export async function triggerAIResponse(
  phone: string,
  conversationSid: string,
  workflowContext?: WorkflowContext,
  expectedLastInboundId?: string,
): Promise<void> {
  try {
    const conversation = await storage.getConversationByPhone(phone);
    if (!conversation) {
      console.log("No conversation found for AI response");
      return;
    }

    const messages = await storage.getMessagesByConversationId(conversation.id);
    if (messages.length === 0) {
      console.log("No messages found for AI response");
      return;
    }

    const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
    const lastMessage = messages[messages.length - 1];

    if (!lastInbound) {
      console.log("No inbound messages available for AI response");
      return;
    }

    if (expectedLastInboundId && lastInbound.id !== expectedLastInboundId) {
      console.log("Skipping AI response due to newer inbound message");
      return;
    }

    if (lastMessage?.direction === "outbound") {
      console.log("Skipping AI response because last message is outbound");
      return;
    }

    console.log("Generating AI response with", messages.length, "messages in history");
    let aiResponse: string;
    try {
      aiResponse = await generateAIResponse(messages, workflowContext);
      console.log("AI generated response:", aiResponse.substring(0, 100) + "...");
    } catch (aiError) {
      console.error("Failed to generate AI response:", aiError);
      return;
    }

    const preparedResponse = applyResponsePolicy({
      response: aiResponse,
      messages,
      conversation,
      workflowContext,
    });

    try {
      const bookingUrl = workflowContext?.bookingUrl;
      let sendText = preparedResponse;
      if (bookingUrl && preparedResponse.includes(bookingUrl)) {
        const personalizedLink = buildBookingLinkForConversation(
          conversation.phone,
          conversation.id,
        );
        sendText = preparedResponse.replaceAll(bookingUrl, personalizedLink);
      }

      await sendConversationMessage(conversationSid, sendText);
    } catch (sendError) {
      console.error("Failed to send AI response via Twilio:", sendError);
      return;
    }

    try {
      await storage.createMessage({
        conversationId: conversation.id,
        text: preparedResponse,
        timestamp: new Date(),
        direction: "outbound",
        status: "sent",
        source: "ai",
      });
      await storage.updateConversation(phone, {
        lastMessage: preparedResponse,
        lastActivity: new Date(),
        needsReply: false,
      });
      console.log(`AI response sent and saved for ${phone}`);

      markWorkflowOutbound(conversation.id, preparedResponse, workflowContext).catch((err) =>
        console.error("Failed to update workflow after AI response:", err),
      );
    } catch (dbError) {
      console.error("Failed to save AI response to database:", dbError);
    }
  } catch (error) {
    console.error("Error in triggerAIResponse:", error);
  }
}

export async function triggerLeadAssessment(phone: string): Promise<void> {
  // Prevent duplicate assessments for the same phone
  if (pendingAssessments.has(phone)) {
    console.log(`Assessment already in progress for ${phone}, skipping`);
    return;
  }

  pendingAssessments.add(phone);

  try {
    const conversation = await storage.getConversationByPhone(phone);
    if (!conversation) {
      console.log("No conversation found for assessment");
      return;
    }

    const messages = await storage.getMessagesByConversationId(conversation.id);
    if (messages.length === 0) {
      console.log("No messages found for assessment");
      return;
    }

    const formattedMessages = messages
      .map((m) => {
        const sender = m.direction === "inbound" ? "Customer" : "Agent";
        const timestamp = new Date(m.timestamp).toLocaleString();
        return `[${timestamp}] ${sender}: ${m.text}`;
      })
      .join("\n");

    const result = await analyzeLeadAssessment(formattedMessages);

    await storage.createOrUpdateAssessment({
      conversationId: conversation.id,
      stage: result.stage,
      probability: result.probability,
      estValue: result.est_value,
      sentiment: result.sentiment,
      vehicleInfo: result.vehicle_info,
      tintPreference: result.tint_preference,
      coverage: result.coverage,
      notes: result.notes,
    });

    console.log(`Lead assessment completed for ${phone}`);
  } catch (error) {
    console.error("Error in triggerLeadAssessment:", error);
    throw error;
  } finally {
    pendingAssessments.delete(phone);
  }
}
