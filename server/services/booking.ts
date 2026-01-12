import type { Conversation } from "@shared/schema";
import { storage } from "../storage";
import { markWorkflowBooked } from "./workflow";
import { isLikelyPhoneNumber } from "../utils/phone";

type BookingPayload = Record<string, unknown>;

interface BookingInput {
  provider: "calcom";
  booking: BookingPayload;
  phone?: string | null;
  conversationId?: string | null;
}

interface NormalizedBooking {
  providerBookingId?: string;
  status?: string;
  startTime?: Date;
  endTime?: Date;
  timezone?: string;
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getDate(value: unknown): Date | undefined {
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
}

function normalizeCalcomBooking(booking: BookingPayload): NormalizedBooking {
  const raw = booking as Record<string, unknown>;
  const providerBookingId =
    getString(raw.id) ||
    getString(raw.uid) ||
    getString(raw.bookingUid) ||
    getString(raw.reference) ||
    getString(raw.bookingId);

  const status = getString(raw.status) || getString(raw.state) || "confirmed";
  const startTime =
    getDate(raw.startTime) ||
    getDate(raw.start_time) ||
    getDate(raw.start) ||
    getDate(raw.startTimeUtc);
  const endTime =
    getDate(raw.endTime) ||
    getDate(raw.end_time) ||
    getDate(raw.end) ||
    getDate(raw.endTimeUtc);
  const timezone = getString(raw.timezone) || getString(raw.timeZone);

  return {
    providerBookingId,
    status,
    startTime,
    endTime,
    timezone,
  };
}

function extractPhoneFromBooking(booking: BookingPayload): string | undefined {
  const raw = booking as Record<string, unknown>;
  const attendees = Array.isArray(raw.attendees) ? raw.attendees : [];
  for (const attendee of attendees) {
    if (attendee && typeof attendee === "object") {
      const phone = getString((attendee as Record<string, unknown>).phone) ||
        getString((attendee as Record<string, unknown>).phoneNumber);
      if (phone && isLikelyPhoneNumber(phone)) {
        return phone;
      }
    }
  }

  const responses = raw.responses;
  if (responses && typeof responses === "object") {
    const responsePhone =
      getString((responses as Record<string, unknown>).phone) ||
      getString((responses as Record<string, unknown>).phoneNumber);
    if (responsePhone && isLikelyPhoneNumber(responsePhone)) {
      return responsePhone;
    }
  }

  const metadata = raw.metadata;
  if (metadata && typeof metadata === "object") {
    const metadataPhone =
      getString((metadata as Record<string, unknown>).phone) ||
      getString((metadata as Record<string, unknown>).phoneNumber) ||
      getString((metadata as Record<string, unknown>).customerPhone);
    if (metadataPhone && isLikelyPhoneNumber(metadataPhone)) {
      return metadataPhone;
    }
  }

  return undefined;
}

function extractConversationIdFromBooking(booking: BookingPayload): string | undefined {
  const raw = booking as Record<string, unknown>;

  // Check metadata first (where our embed tracking sends it)
  const metadata = raw.metadata;
  if (metadata && typeof metadata === "object") {
    const conversationId =
      getString((metadata as Record<string, unknown>).conversation_id) ||
      getString((metadata as Record<string, unknown>).conversationId) ||
      getString((metadata as Record<string, unknown>).cid);
    if (conversationId) {
      return conversationId;
    }
  }

  // Check nested payload metadata (Cal.com webhook structure)
  const payload = raw.payload;
  if (payload && typeof payload === "object") {
    const payloadMetadata = (payload as Record<string, unknown>).metadata;
    if (payloadMetadata && typeof payloadMetadata === "object") {
      const conversationId =
        getString((payloadMetadata as Record<string, unknown>).conversation_id) ||
        getString((payloadMetadata as Record<string, unknown>).conversationId) ||
        getString((payloadMetadata as Record<string, unknown>).cid);
      if (conversationId) {
        return conversationId;
      }
    }
  }

  return undefined;
}

function formatBookingMessage(startTime?: Date, timezone?: string): string {
  if (!startTime) {
    return "Booking confirmed via Cal.com.";
  }

  const formatted = startTime.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const tzSuffix = timezone ? ` (${timezone})` : "";
  return `Booking confirmed via Cal.com for ${formatted}${tzSuffix}.`;
}

async function getConversationForBooking(
  conversationId?: string | null,
  phone?: string | null,
): Promise<Conversation | undefined> {
  if (conversationId) {
    const byId = await storage.getConversationById(conversationId);
    if (byId) return byId;
  }

  if (phone) {
    const byPhone = await storage.getConversationByPhone(phone);
    if (byPhone) return byPhone;
  }

  return undefined;
}

export async function recordBooking({
  provider,
  booking,
  phone,
  conversationId,
}: BookingInput): Promise<Conversation | undefined> {
  const normalized = normalizeCalcomBooking(booking);
  const directPhone = phone && isLikelyPhoneNumber(phone) ? phone : undefined;
  const inferredPhone = directPhone || extractPhoneFromBooking(booking);

  // Try to get conversation ID from metadata if not provided directly
  const resolvedConversationId = conversationId || extractConversationIdFromBooking(booking);

  let conversation = await getConversationForBooking(resolvedConversationId, inferredPhone);
  if (!conversation && inferredPhone) {
    conversation = await storage.createConversation({
      phone: inferredPhone,
      name: null,
      lastMessage: null,
      lastActivity: new Date(),
      needsReply: false,
    });
  }
  if (!conversation) {
    console.warn("Booking received but no conversation found.");
    return undefined;
  }

  if (normalized.providerBookingId) {
    const existing = await storage.getBookingByProviderId(
      provider,
      normalized.providerBookingId,
    );
    if (existing) {
      return conversation;
    }
  }

  await storage.createBooking({
    conversationId: conversation.id,
    provider,
    providerBookingId: normalized.providerBookingId || null,
    status: normalized.status || "confirmed",
    startTime: normalized.startTime || null,
    endTime: normalized.endTime || null,
    timezone: normalized.timezone || null,
    payload: booking,
  });

  const messageText = formatBookingMessage(normalized.startTime, normalized.timezone);

  await storage.createMessage({
    conversationId: conversation.id,
    text: messageText,
    timestamp: new Date(),
    direction: "outbound",
    status: "sent",
    source: "booking",
  });

  await storage.updateConversation(conversation.phone, {
    lastMessage: messageText,
    lastActivity: new Date(),
    needsReply: false,
    readyToBook: false,
    bookingNotes: "Booked via Cal.com",
  });

  await markWorkflowBooked(conversation.id);

  return conversation;
}
