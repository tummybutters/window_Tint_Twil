import type { Conversation, Message } from "@shared/schema";
import type { WorkflowContext } from "./workflow";
import { company } from "../config/company";

const SIMILARITY_THRESHOLD = 0.75;

const linkRequestPattern =
  /\b(link|booking link|book(ing)?|schedule|appointment|calendar|cal\.com)\b/i;
const scheduleRequestPattern =
  /\b(availability|available|times?|slots?|day|date|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i;

const fallbackPrompts = {
  service: [
    "Quick question - are you looking to tint the full car, just the front two windows, or the windshield?",
    "Which tint service do you need: full vehicle, partial, or removal?",
  ],
  vehicle: [
    "What year, make, and model is your vehicle?",
    "To give you an accurate quote, what car will we be working on?",
  ],
  location: [
    "We're mobile! What city in Orange County (or nearby) are you located in?",
    "Which city should we come to for the service?",
  ],
  schedule: [
    "What day or time window works best for your appointment?",
    "Do you have a preferred day for us to come out?",
  ],
  booking_link: [
    "If you're ready to lock it in, I can send over the booking link.",
    "Would you like the link to secure your spot?",
  ],
  quote: [
    "For our Premium Ceramic tint, prices vary slightly by model. Do you prefer 5% (Limo), 20%, or 50% shade?",
    "We specialize in IR Ceramic Tint. Did you have a specific shade in mind (Limo, Medium, Light)?",
  ],
  general: [
    "Got it. How else can I help you with your tinting needs?",
    "Happy to help - do you have any other questions about our film or process?",
  ],
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function similarityScore(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection += 1;
  });
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getLastMessage(
  messages: Message[],
  direction: "inbound" | "outbound",
  source?: string,
): Message | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].direction === direction && (!source || messages[i].source === source)) {
      return messages[i];
    }
  }
  return null;
}

function isExplicitLinkRequest(text: string | null | undefined): boolean {
  if (!text) return false;
  return linkRequestPattern.test(text);
}

function isScheduleRequest(text: string | null | undefined): boolean {
  if (!text) return false;
  return scheduleRequestPattern.test(text);
}

function stripBookingLink(text: string, bookingUrl: string): string {
  const lines = text.split(/\n+/).filter((line) => !line.includes(bookingUrl));
  return lines.join("\n").replace(/\s{2,}/g, " ").trim();
}

function pickVariant(options: string[], seed: string): string {
  if (options.length === 1) return options[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 10000;
  }
  return options[hash % options.length];
}

function buildFallbackResponse(
  context: WorkflowContext | undefined,
  conversation: Conversation,
): string {
  if (!context) {
    return pickVariant(fallbackPrompts.general, conversation.id);
  }

  const stage = context.stage;
  const missing = context.missingFields;
  const seed = `${conversation.id}-${stage}`;

  if (missing.includes("service")) {
    return pickVariant(fallbackPrompts.service, seed);
  }
  if (missing.includes("vehicle")) {
    return pickVariant(fallbackPrompts.vehicle, seed);
  }
  if (missing.includes("location")) {
    return pickVariant(fallbackPrompts.location, seed);
  }
  if (stage === "quote") {
    return pickVariant(fallbackPrompts.quote, seed);
  }
  if (stage === "schedule") {
    return pickVariant(fallbackPrompts.schedule, seed);
  }
  if (stage === "booking_link") {
    return pickVariant(fallbackPrompts.booking_link, seed);
  }

  return pickVariant(fallbackPrompts.general, seed);
}

function ensureBookingLink(text: string, bookingUrl: string): string {
  if (text.includes(bookingUrl)) return text;
  return `${text}\n\nBook here: ${bookingUrl}`.trim();
}

function applyLinkPolicy({
  text,
  bookingUrl,
  bookingLinkSent,
  lastInboundText,
  stage,
}: {
  text: string;
  bookingUrl: string;
  bookingLinkSent: boolean;
  lastInboundText?: string | null;
  stage?: string;
}): string {
  const explicitLinkRequest = isExplicitLinkRequest(lastInboundText || "");
  const scheduleRequest = isScheduleRequest(lastInboundText || "");

  if (!bookingLinkSent && stage === "booking_link") {
    return ensureBookingLink(text, bookingUrl);
  }

  if (bookingLinkSent && text.includes(bookingUrl) && !explicitLinkRequest) {
    const stripped = stripBookingLink(text, bookingUrl);
    if (stripped) {
      return `${stripped}\n\nWant me to resend the booking link?`;
    }
    return "Want me to resend the booking link?";
  }

  if (!bookingLinkSent && (explicitLinkRequest || scheduleRequest)) {
    return ensureBookingLink(text, bookingUrl);
  }

  return text;
}

export function applyResponsePolicy({
  response,
  messages,
  conversation,
  workflowContext,
}: {
  response: string;
  messages: Message[];
  conversation: Conversation;
  workflowContext?: WorkflowContext;
}): string {
  const bookingUrl = workflowContext?.bookingUrl || company.bookingUrl;
  const bookingLinkSent = workflowContext?.flags.bookingLinkSent ?? false;
  const stage = workflowContext?.stage;

  const lastOutbound = getLastMessage(messages, "outbound", "ai");
  const lastInbound = getLastMessage(messages, "inbound");

  let adjusted = response.trim();

  adjusted = applyLinkPolicy({
    text: adjusted,
    bookingUrl,
    bookingLinkSent,
    lastInboundText: lastInbound?.text,
    stage,
  });

  if (lastOutbound && similarityScore(adjusted, lastOutbound.text) >= SIMILARITY_THRESHOLD) {
    adjusted = buildFallbackResponse(workflowContext, conversation);
    adjusted = applyLinkPolicy({
      text: adjusted,
      bookingUrl,
      bookingLinkSent,
      lastInboundText: lastInbound?.text,
      stage,
    });
  }

  return adjusted.trim();
}
