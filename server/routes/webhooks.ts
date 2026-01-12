import { Router } from "express";
import { company } from "../config/company";
import { validateTwilioSignature } from "../middleware/validateTwilioSignature";
import { handleCallStatus } from "../services/call-handling";
import { handleInboundMessage } from "../services/inbound-message";
import { recordBooking } from "../services/booking";
import { handleRecordingReady } from "../services/call-transcription";
import { getBaseUrl } from "../utils/request";
import { isLikelyPhoneNumber, maskPhoneNumber, summarizeMessageBody } from "../utils/phone";
import { storage } from "../storage";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/webhook/calcom",
  async (req, res) => {
    try {
      console.log("\n[WEBHOOK: /webhook/calcom] Cal.com booking received");

      // Cal.com webhook structure varies by trigger type
      // For booking created events, the payload structure is:
      // { triggerEvent: "BOOKING_CREATED", payload: { ... booking data ... } }
      const triggerEvent = req.body?.triggerEvent;
      const booking = req.body?.payload ?? req.body?.booking ?? req.body;

      if (!booking) {
        console.error("[calcom-webhook] No booking payload found in request");
        return res.status(400).json({ error: "Missing booking payload" });
      }

      // Extract metadata - this is where our tracking data lives
      // The booking embed passes: { conversation_id, phone, source, ... }
      const metadata = booking?.metadata ?? booking?.payload?.metadata ?? {};

      // Try multiple sources for conversation ID (in priority order)
      const conversationId =
        req.body?.conversationId ??     // Direct pass-through
        metadata?.conversation_id ??    // From our embed tracking
        metadata?.cid ??                // Alternate key
        null;

      // Try multiple sources for phone
      const phone =
        req.body?.phone ??              // Direct pass-through
        metadata?.phone ??              // From our embed tracking
        null;

      // Track the source for commission attribution
      const source = metadata?.source ?? "unknown";
      const isAiLead = source === "ai_lead" || Boolean(conversationId);

      console.log(`[calcom-webhook] Booking attribution:`);
      console.log(`  - Source: ${source}`);
      console.log(`  - Conversation ID: ${conversationId ?? "none"}`);
      console.log(`  - Phone: ${phone ? "***" + phone.slice(-4) : "none"}`);
      console.log(`  - AI Lead: ${isAiLead ? "YES" : "NO"}`);
      console.log(`  - Trigger Event: ${triggerEvent ?? "none"}`);

      const conversation = await recordBooking({
        provider: "calcom",
        booking,
        phone,
        conversationId,
      });

      if (conversation && isAiLead) {
        console.log(`[calcom-webhook] ✓ AI LEAD CONVERTED: Booking linked to conversation ${conversation.id}`);
      }

      res.json({
        success: true,
        conversationId: conversation?.id ?? null,
        source,
        aiLeadAttribution: isAiLead,
      });
    } catch (error) {
      console.error("Cal.com booking webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);


webhooksRouter.post(
  "/webhook/twilio-call",
  validateTwilioSignature({ context: "voice-webhook" }),
  async (req, res) => {
    console.log("\n[WEBHOOK: /webhook/twilio-call] Voice call received");

    if (!company.callHandling.forwardToNumber) {
      console.error("[voice-webhook] TWILIO_FORWARD_TO_NUMBER not configured");
      return res
        .status(500)
        .type("text/xml")
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to connect your call right now. Please try again later.</Say></Response>',
        );
    }

    const callerNumber = (req.body?.Caller as string) || (req.body?.From as string);
    const callSid = req.body?.CallSid as string;

    if (!callerNumber) {
      console.error(
        "[voice-webhook] No caller number provided in webhook (missing Caller and From fields)",
      );
      return res
        .status(200)
        .type("text/xml")
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are experiencing technical difficulties. Please try again later.</Say></Response>',
        );
    }

    // Create or get conversation for this caller
    let conversation = await storage.getConversationByPhone(callerNumber);
    if (!conversation) {
      conversation = await storage.createConversation({
        phone: callerNumber,
        name: null,
        lastMessage: "[Incoming call]",
        lastActivity: new Date(),
        aiEnabled: true,
        needsReply: false,
      });
    }

    // Create call record
    if (callSid) {
      try {
        await storage.createCall({
          conversationId: conversation.id,
          callSid,
          direction: "inbound",
          status: "ringing",
          startedAt: new Date(),
        });
      } catch (error) {
        // Call might already exist (duplicate webhook)
        console.log("Call record already exists or error creating:", error);
      }
    }

    const statusCallbackUrl = new URL(
      "/webhook/twilio-call-status",
      getBaseUrl(req),
    ).toString();

    const recordingCallbackUrl = new URL(
      "/webhook/twilio-recording",
      getBaseUrl(req),
    ).toString();

    // Enable recording with record="record-from-answer-dual" to capture both sides
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="${statusCallbackUrl}" method="POST" timeout="${company.callHandling.forwardTimeoutSeconds}" callerId="${callerNumber}" record="record-from-answer-dual" recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed">
    <Number>${company.callHandling.forwardToNumber}</Number>
  </Dial>
</Response>`;

    console.log(
      `Voice call from ${maskPhoneNumber(callerNumber)} forwarding to ${maskPhoneNumber(
        company.callHandling.forwardToNumber,
      )} (with recording)`,
    );

    res.type("text/xml").send(twiml);
  },
);

webhooksRouter.post(
  "/webhook/twilio-call-status",
  validateTwilioSignature({ context: "voice-status-callback" }),
  async (req, res) => {
    console.log("\n[WEBHOOK: /webhook/twilio-call-status] Call status update received");

    try {
      const callerNumber = (req.body?.Caller as string) || (req.body?.From as string);
      const callSid = req.body?.CallSid as string;
      const dialStatus =
        (req.body?.DialCallStatus as string) || (req.body?.CallStatus as string) || "";
      const durationStr =
        (req.body?.DialCallDuration as string) || (req.body?.CallDuration as string) || "0";
      const dialDurationSeconds = Number.parseInt(durationStr, 10) || 0;

      if (!callerNumber) {
        console.error(
          "[voice-status] No caller number provided in status callback (missing Caller and From fields)",
        );
        return res.status(200).send("ok");
      }

      console.log(
        `Voice status for ${maskPhoneNumber(callerNumber)} :: status=${dialStatus} duration=${dialDurationSeconds}s`,
      );

      // Update call record with final status
      if (callSid) {
        const call = await storage.getCallByCallSid(callSid);
        if (call) {
          await storage.updateCall(call.id, {
            status: dialStatus || "completed",
            durationSeconds: dialDurationSeconds,
            endedAt: new Date(),
          });
        }
      }

      await handleCallStatus({ callerNumber, dialDurationSeconds });

      res.status(200).send("ok");
    } catch (error) {
      console.error("Voice status callback error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Recording status callback - triggered when recording is ready
webhooksRouter.post(
  "/webhook/twilio-recording",
  validateTwilioSignature({ context: "recording-callback" }),
  async (req, res) => {
    console.log("\n[WEBHOOK: /webhook/twilio-recording] Recording status received");

    try {
      const {
        CallSid,
        RecordingSid,
        RecordingUrl,
        RecordingStatus,
        RecordingDuration,
      } = req.body;

      console.log(
        `Recording ${RecordingSid} for call ${CallSid}: status=${RecordingStatus} duration=${RecordingDuration}s`,
      );

      if (RecordingStatus === "completed" && RecordingUrl) {
        const duration = Number.parseInt(RecordingDuration || "0", 10);

        // Process the recording asynchronously
        handleRecordingReady(CallSid, RecordingSid, RecordingUrl, duration).catch((error) => {
          console.error("Failed to handle recording:", error);
        });
      }

      res.status(200).send("ok");
    } catch (error) {
      console.error("Recording callback error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

webhooksRouter.post(
  "/webhook/twilio",
  validateTwilioSignature({ context: "sms-webhook" }),
  async (req, res) => {
    try {
      const { From, Body, NumMedia, MediaUrl0, MediaContentType0, MessageSid } = req.body;

      console.log("\n[WEBHOOK: /webhook/twilio] Direct SMS received");

      if (!From) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numMedia = parseInt(NumMedia || "0", 10);
      const hasMedia = numMedia > 0;
      const mediaUrl = hasMedia ? MediaUrl0 : undefined;
      const mediaType = hasMedia ? MediaContentType0 : undefined;

      console.log(
        `From: ${maskPhoneNumber(From)} | ${hasMedia ? "MMS" : "SMS"} (${Body?.length ?? 0} chars)${hasMedia ? ` with ${mediaType}` : ""
        }`,
      );
      // Note: Message content intentionally not logged for privacy compliance

      await handleInboundMessage({
        phone: From,
        text: Body,
        mediaUrl,
        mediaType,
        externalId: MessageSid,
        source: "twilio-sms",
      });

      res
        .type("text/xml")
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

webhooksRouter.post(
  "/webhook/conversations",
  validateTwilioSignature({ context: "conversations-webhook" }),
  async (req, res) => {
    try {
      const { EventType, ConversationSid, Body, Author, Media, MessageSid, Sid } = req.body;
      const externalMessageId = MessageSid || Sid;

      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (Media && typeof Media === "string") {
        try {
          const mediaData = JSON.parse(Media);
          if (mediaData && mediaData.length > 0) {
            mediaUrl = mediaData[0].Url;
            mediaType = mediaData[0].ContentType;
          }
        } catch (error) {
          console.error("Failed to parse Media field:", error);
        }
      }

      console.log("\n[WEBHOOK: /webhook/conversations] Twilio Conversations API event");
      console.log(`EventType: ${EventType} | ConversationSid: ${ConversationSid}`);
      if (Author) {
        console.log(`Author: ${maskPhoneNumber(Author)}`);
      }
      if (Body) {
        // Note: Message content intentionally not logged for privacy compliance
        console.log(`Message: (${Body.length} chars)`);
      }
      if (mediaUrl) {
        console.log(`Media: ${mediaType}`);
      }

      if (EventType !== "onMessageAdded") {
        return res.sendStatus(200);
      }

      if (!isLikelyPhoneNumber(Author)) {
        console.log("Skipping non-SMS author message");
        return res.sendStatus(200);
      }

      await handleInboundMessage({
        phone: Author,
        text: Body,
        conversationSid: ConversationSid,
        mediaUrl,
        mediaType,
        externalId: externalMessageId,
        source: "twilio-conversations",
      });

      res.sendStatus(200);
    } catch (error) {
      console.error("Conversations webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
