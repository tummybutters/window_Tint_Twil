import { Router } from "express";
import { z } from "zod";
import type { InsertConversation } from "@shared/schema";
import { storage } from "../storage";
import {
  addWebUserToConversation,
  generateAccessToken,
  getOrCreateConversation,
  sendConversationMessage,
} from "../twilio";
import { triggerLeadAssessment, isAssessmentPending } from "../services/ai-workflow";
import { cancelPendingAIResponse } from "../services/reply-scheduler";
import { markWorkflowOutbound } from "../services/workflow";

export const apiRouter = Router();

const sendMessageSchema = z.object({
  text: z.string().min(1, "Message text is required"),
});

const twilioTokenRequestSchema = z.object({
  identity: z
    .string()
    .min(1, "Identity cannot be empty")
    .max(64, "Identity too long")
    .regex(/^[\w-]+$/, "Identity must be alphanumeric with underscores or dashes")
    .optional(),
});

apiRouter.get("/conversations", async (_req, res) => {
  try {
    const conversations = await storage.getAllConversations();
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

apiRouter.get("/conversations/:phone/messages", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const messages = await storage.getMessagesByPhone(phone);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

apiRouter.post("/conversations/:phone/messages", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);

    const validation = sendMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const { text } = validation.data;

    let conversation = await storage.getConversationByPhone(phone);
    if (!conversation) {
      conversation = await storage.createConversation({
        phone,
        name: null,
        lastMessage: text,
        lastActivity: new Date(),
        needsReply: false,
      });
    }

    const twilioConversation = await getOrCreateConversation(phone);

    if (!conversation.conversationSid) {
      conversation = await storage.updateConversation(phone, {
        conversationSid: twilioConversation.sid,
      });
    }

    const message = await storage.createMessage({
      conversationId: conversation.id,
      text,
      timestamp: new Date(),
      direction: "outbound",
      status: "sending",
      source: "dashboard",
    });

    try {
      await sendConversationMessage(twilioConversation.sid, text);

      await storage.updateMessageStatus(message.id, "sent");
      await storage.updateConversation(phone, {
        lastMessage: text,
        lastActivity: new Date(),
        needsReply: false,
      });

      markWorkflowOutbound(conversation.id, text).catch((err) =>
        console.error("Failed to update workflow after manual reply:", err),
      );

      res.json({ ...message, status: "sent" });
    } catch (twilioError) {
      console.error("Twilio Conversations error:", twilioError);
      await storage.updateMessageStatus(message.id, "failed");
      res.status(500).json({ error: "Failed to send message via Twilio" });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

apiRouter.get("/conversations/:phone/assessment", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const assessment = await storage.getAssessmentByPhone(phone);

    if (!assessment) {
      // Only trigger if not already in progress
      if (!isAssessmentPending(phone)) {
        triggerLeadAssessment(phone).catch((err) =>
          console.error("Error triggering assessment:", err),
        );
      }
      return res.json(null);
    }

    res.json(assessment);
  } catch (error) {
    console.error("Error fetching assessment:", error);
    res.status(500).json({ error: "Failed to fetch assessment" });
  }
});

apiRouter.delete("/conversations/:phone", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const existingConversation = await storage.getConversationByPhone(phone);

    if (!existingConversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await storage.deleteConversation(phone);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

apiRouter.post("/twilio/token", async (req, res) => {
  try {
    const parsedRequest = twilioTokenRequestSchema.safeParse(req.body ?? {});
    if (!parsedRequest.success) {
      return res
        .status(400)
        .json({ error: "Invalid identity request", details: parsedRequest.error.format() });
    }

    const requestedIdentity = parsedRequest.data.identity;
    const identity =
      requestedIdentity ||
      `web_user_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const token = await generateAccessToken(identity);

    res.json({
      token,
      identity,
    });
  } catch (error) {
    console.error("Error generating access token:", error);
    res.status(500).json({ error: "Failed to generate access token" });
  }
});

apiRouter.post("/conversations/:phone/join", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const { identity } = req.body;

    if (!identity) {
      return res.status(400).json({ error: "Identity is required" });
    }

    let conversation = await storage.getConversationByPhone(phone);
    if (!conversation) {
      conversation = await storage.createConversation({
        phone,
        name: null,
        lastMessage: null,
        lastActivity: new Date(),
      });
    }

    const twilioConversation = await getOrCreateConversation(phone);

    if (!conversation.conversationSid) {
      await storage.updateConversation(phone, {
        conversationSid: twilioConversation.sid,
      });
    }

    await addWebUserToConversation(twilioConversation.sid, identity);

    res.json({
      conversationSid: twilioConversation.sid,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("Error joining conversation:", error);
    res.status(500).json({ error: "Failed to join conversation" });
  }
});

apiRouter.post("/conversations/init", async (req, res) => {
  try {
    const phone = req.query.phone || req.body.phone;
    const message = req.query.message || req.body.message;
    const messageSid = req.query.messageSid || req.body.messageSid;

    if (!phone || !message) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["phone", "message"],
      });
    }

    console.log(
      `Init conversation for ${phone}: ${message.substring(0, 50)}...${messageSid ? ` (sid: ${messageSid})` : ""}`,
    );

    if (messageSid) {
      const existing = await storage.getMessageByExternalId("n8n", String(messageSid));
      if (existing) {
        const existingConversation = await storage.getConversationByPhone(phone as string);
        return res.json({
          success: true,
          conversationId: existing.conversationId,
          conversationSid: existingConversation?.conversationSid || null,
          phone,
        });
      }
    }

    let conversation = await storage.getConversationByPhone(phone as string);

    if (!conversation) {
      conversation = await storage.createConversation({
        phone: phone as string,
        name: null,
        lastMessage: message as string,
        lastActivity: new Date(),
        needsReply: false,
      });
    } else {
      conversation = await storage.updateConversation(phone as string, {
        lastMessage: message as string,
        lastActivity: new Date(),
        needsReply: false,
      });
    }

    try {
      const twilioConversation = await getOrCreateConversation(phone as string);

      if (!conversation.conversationSid) {
        conversation = await storage.updateConversation(phone as string, {
          conversationSid: twilioConversation.sid,
        });
      }
    } catch (twilioError) {
      console.error("Twilio conversation creation failed:", twilioError);
    }

    await storage.createMessage({
      conversationId: conversation.id,
      text: message as string,
      timestamp: new Date(),
      direction: "outbound",
      status: "sent",
      externalId: messageSid ? String(messageSid) : null,
      source: "n8n",
    });

    res.json({
      success: true,
      conversationId: conversation.id,
      conversationSid: conversation.conversationSid,
      phone: conversation.phone,
    });
  } catch (error) {
    console.error("Error initializing conversation:", error);
    res.status(500).json({ error: "Failed to initialize conversation" });
  }
});

apiRouter.post("/conversations/:phone/ai-toggle", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled field must be a boolean" });
    }

    const conversation = await storage.getConversationByPhone(phone);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const updates: Partial<InsertConversation> = { aiEnabled: enabled };
    if (enabled) {
      updates.callSuppressedAt = null;
    }

    await storage.updateConversation(phone, updates);

    console.log(`AI assistant ${enabled ? "enabled" : "disabled"} for ${phone}`);

    if (!enabled) {
      cancelPendingAIResponse(phone);
    }

    res.json({ success: true, aiEnabled: enabled });
  } catch (error) {
    console.error("Error toggling AI assistant:", error);
    res.status(500).json({ error: "Failed to toggle AI assistant" });
  }
});

// Get calls for a conversation
apiRouter.get("/conversations/:phone/calls", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const conversation = await storage.getConversationByPhone(phone);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const calls = await storage.getCallsByConversationId(conversation.id);
    res.json(calls);
  } catch (error) {
    console.error("Error fetching calls:", error);
    res.status(500).json({ error: "Failed to fetch calls" });
  }
});

// Get bookings for a conversation
apiRouter.get("/conversations/:phone/bookings", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const conversation = await storage.getConversationByPhone(phone);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const bookings = await storage.getBookingsByConversationId(conversation.id);
    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Update booking job value
const updateJobValueSchema = z.object({
  jobValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Job value must be a valid decimal"),
});

apiRouter.patch("/bookings/:bookingId/job-value", async (req, res) => {
  try {
    const { bookingId } = req.params;

    const validation = updateJobValueSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const { jobValue } = validation.data;
    const booking = await storage.updateBookingJobValue(bookingId, jobValue);

    res.json(booking);
  } catch (error) {
    console.error("Error updating job value:", error);
    res.status(500).json({ error: "Failed to update job value" });
  }
});

// Commission report - get all bookings with job values
const COMMISSION_RATE = 0.09; // 9%

apiRouter.get("/reports/commission", async (req, res) => {
  try {
    // Get all conversations with their bookings
    const conversations = await storage.getAllConversations();
    const report = [];

    for (const conversation of conversations) {
      const bookings = await storage.getBookingsByConversationId(conversation.id);

      for (const booking of bookings) {
        if (booking.jobValue) {
          const jobValueNum = parseFloat(booking.jobValue);
          const commission = jobValueNum * COMMISSION_RATE;

          report.push({
            date: booking.createdAt,
            phone: conversation.phone,
            conversationId: conversation.id,
            bookingId: booking.id,
            provider: booking.provider,
            status: booking.status,
            jobValue: jobValueNum,
            commissionRate: COMMISSION_RATE,
            commissionOwed: Math.round(commission * 100) / 100,
          });
        }
      }
    }

    // Sort by date descending
    report.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate totals
    const totalRevenue = report.reduce((sum, r) => sum + r.jobValue, 0);
    const totalCommission = report.reduce((sum, r) => sum + r.commissionOwed, 0);

    res.json({
      report,
      summary: {
        totalBookings: report.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        commissionRate: COMMISSION_RATE,
      },
    });
  } catch (error) {
    console.error("Error generating commission report:", error);
    res.status(500).json({ error: "Failed to generate commission report" });
  }
});
