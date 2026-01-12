import type {
  Conversation,
  WorkflowData,
  WorkflowFlags,
  WorkflowIntent,
  WorkflowProfile,
  WorkflowStage,
} from "@shared/schema";
import { storage } from "../storage";
import { extractWorkflowSignals } from "../openai";
import { company } from "../config/company";
import { notifyReadyToBook } from "./notifications";

export type WorkflowContext = {
  stage: WorkflowStage;
  intent?: WorkflowIntent;
  profile: WorkflowProfile;
  flags: WorkflowFlags;
  missingFields: string[];
  bookingUrl: string;
};

type ExtractionProfile = {
  full_name: string;
  phone: string;
  location: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_type: string;
  tint_type: string;
  coverage_wanted: string;
  primary_concern: string;
  budget: string;
  preferred_day: string;
  preferred_time: string;
  notes: string;
};

type WorkflowExtraction = {
  intent: WorkflowIntent;
  booking_intent: boolean;
  schedule_request: boolean;
  call_request: boolean;
  opt_out: boolean;
  profile: ExtractionProfile;
  notes: string;
};

const emptyProfile: WorkflowProfile = {};

function normalizeValue(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lowered = trimmed.toLowerCase();
  if (["n/a", "na", "unknown", "none"].includes(lowered)) {
    return undefined;
  }
  return trimmed;
}

function mergeProfile(existing: WorkflowProfile, updates: Partial<WorkflowProfile>): WorkflowProfile {
  return {
    ...existing,
    ...Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    ),
  };
}

function mapExtractionProfile(profile: ExtractionProfile): Partial<WorkflowProfile> {
  return {
    fullName: normalizeValue(profile.full_name),
    phone: normalizeValue(profile.phone),
    location: normalizeValue(profile.location),
    vehicleYear: normalizeValue(profile.vehicle_year),
    vehicleMake: normalizeValue(profile.vehicle_make),
    vehicleModel: normalizeValue(profile.vehicle_model),
    vehicleType: normalizeValue(profile.vehicle_type),
    tintType: normalizeValue(profile.tint_type),
    coverageWanted: normalizeValue(profile.coverage_wanted),
    primaryConcern: normalizeValue(profile.primary_concern),
    budget: normalizeValue(profile.budget),
    preferredDay: normalizeValue(profile.preferred_day),
    preferredTime: normalizeValue(profile.preferred_time),
    notes: normalizeValue(profile.notes),
  };
}

function normalizeWorkflowData(data?: WorkflowData | null): WorkflowData {
  return {
    profile: data?.profile ?? {},
    flags: data?.flags ?? {},
    lastIntent: data?.lastIntent,
    notes: data?.notes,
  };
}

function buildConversationHistory(messages: { direction: string; text: string }[]): string {
  const recent = messages.slice(-12);
  return recent
    .map((message) => {
      const sender = message.direction === "inbound" ? "Customer" : "Agent";
      return `${sender}: ${message.text}`;
    })
    .join("\n");
}

function determineStage(data: WorkflowData, extraction: WorkflowExtraction): WorkflowStage {
  if (data.flags.booked) return "booked";
  if (data.flags.optOut || extraction.opt_out) return "handoff";
  if (extraction.call_request) return "handoff";

  const profile = data.profile;

  if (!profile.vehicleType) return "vehicle"; // First ask: car, truck, or SUV?
  if (!profile.coverageWanted) return "service"; // Then ask: windows/windshield/full?
  if (!profile.tintType) return "quote"; // Ask preference (Ceramic/Carbon)
  if (!profile.location) return "location";
  if (!data.flags.priceQuoted) return "quote";

  const hasSchedulePref = Boolean(profile.preferredDay || profile.preferredTime);
  const wantsBooking =
    extraction.booking_intent || extraction.schedule_request || hasSchedulePref;

  if (wantsBooking && !data.flags.bookingLinkSent) return "booking_link";
  if (!hasSchedulePref) return "schedule";

  return data.flags.bookingLinkSent ? "booking_link" : "schedule";
}

function getMissingFields(profile: WorkflowProfile, stage: WorkflowStage): string[] {
  const missing: string[] = [];
  if (!profile.vehicleType) missing.push("vehicle_type");
  if (!profile.coverageWanted) missing.push("coverage_wanted");
  if (!profile.tintType) missing.push("tint_type");
  if (!profile.location) missing.push("location");

  if (["schedule", "booking_link"].includes(stage)) {
    if (!profile.preferredDay && !profile.preferredTime) {
      missing.push("preferred_day_or_time");
    }
  }

  return missing;
}

function buildWorkflowContext(
  stage: WorkflowStage,
  intent: WorkflowIntent | undefined,
  data: WorkflowData,
): WorkflowContext {
  return {
    stage,
    intent,
    profile: data.profile,
    flags: data.flags,
    missingFields: getMissingFields(data.profile, stage),
    bookingUrl: company.bookingUrl,
  };
}

export function buildWorkflowSystemPrompt(context: WorkflowContext): string {
  const { stage, intent, profile, flags, missingFields, bookingUrl } = context;
  const knownFields: string[] = [];

  if (profile.fullName) knownFields.push(`name=${profile.fullName}`);
  if (profile.vehicleType) knownFields.push(`vehicle_type=${profile.vehicleType}`);
  if (profile.coverageWanted) knownFields.push(`coverage=${profile.coverageWanted}`);
  if (profile.tintType) knownFields.push(`tint_type=${profile.tintType}`);
  if (profile.location) knownFields.push(`location=${profile.location}`);
  if (profile.primaryConcern) knownFields.push(`concern=${profile.primaryConcern}`);
  if (profile.preferredDay) knownFields.push(`preferred_day=${profile.preferredDay}`);
  if (profile.preferredTime) knownFields.push(`preferred_time=${profile.preferredTime}`);

  const knownSummary = knownFields.length ? knownFields.join(", ") : "none";
  const missingSummary = missingFields.length ? missingFields.join(", ") : "none";

  const bookingLinkInstruction = flags.bookingLinkSent
    ? "Do not repeat the booking link. Ask if they want it resent or if you'd like to help pick a time."
    : "Share the booking link so they can pick an exact time. Do not suggest specific times yourself.";

  const stageInstruction: Record<WorkflowStage, string> = {
    new: "Acknowledge and ask what kind of vehicle they have (car, truck, or SUV).",
    vehicle: "Ask if they have a specific year/make/model to help with the quote.",
    service: 'Ask clarifying questions: "Are you looking to tint the full car, just the sides and back, or the windshield?"',
    location: "Ask for their city to determine if they are in our service area (OC, LA, IE).",
    quote:
      "Explain the benefits of IR Ceramic Tint (heat rejection, UV protection). Provide a base price range if vehicle/coverage is known.",
    schedule:
      "Ask for their preferred day or time window for the appointment. Mention both shop and mobile options.",
    booking_link: bookingLinkInstruction,
    booked: "Confirm their booking details and thank them for choosing Obsidian Auto Works.",
    handoff:
      `Acknowledge and say you will connect them with the Manager for further assistance.`,
  };

  return `Workflow context (internal):
stage: ${stage}
intent: ${intent || "unknown"}
known: ${knownSummary}
missing: ${missingSummary}
price_quoted: ${flags.priceQuoted ? "yes" : "no"}
booking_link_sent: ${flags.bookingLinkSent ? "yes" : "no"}
booking_url: ${bookingUrl}

Guidance:
${stageInstruction[stage]}
If you share a booking link, use exactly: ${bookingUrl}
Do not mention internal context or stages to the customer.`;
}

export function buildBookingLinkForConversation(
  phone: string,
  conversationId?: string,
): string {
  try {
    const url = new URL(company.bookingUrl);
    url.searchParams.set("phone", phone);
    if (conversationId) {
      url.searchParams.set("cid", conversationId);
    }
    return url.toString();
  } catch (error) {
    console.error("Invalid booking URL:", error);
    return company.bookingUrl;
  }
}

function mergeWorkflowData(existing: WorkflowData, extraction: WorkflowExtraction): WorkflowData {
  const updatedProfile = mergeProfile(
    existing.profile ?? emptyProfile,
    mapExtractionProfile(extraction.profile),
  );

  return {
    profile: updatedProfile,
    flags: {
      ...existing.flags,
      optOut: existing.flags.optOut || extraction.opt_out,
    },
    lastIntent: extraction.intent || existing.lastIntent,
    notes: extraction.notes || existing.notes,
  };
}

export async function updateWorkflowFromInbound(
  conversation: Conversation,
): Promise<{ context: WorkflowContext; conversation: Conversation }> {
  const messages = await storage.getMessagesByConversationId(conversation.id);
  const history = buildConversationHistory(messages);
  const historyText = messages.map((message) => message.text || "").join(" ");

  const existingState = await storage.getWorkflowStateByConversationId(conversation.id);
  const existingData = normalizeWorkflowData(existingState?.data);

  let extraction: WorkflowExtraction;
  try {
    extraction = await extractWorkflowSignals(history, existingData.profile);
  } catch (error) {
    console.error("Workflow extraction failed; using last known state.", error);
    const stageFallback = existingState?.stage ?? "new";
    return {
      context: buildWorkflowContext(
        stageFallback as WorkflowStage,
        existingState?.intent as WorkflowIntent | undefined,
        existingData,
      ),
      conversation,
    };
  }

  const mergedData = mergeWorkflowData(existingData, extraction);
  mergedData.flags = {
    ...mergedData.flags,
    bookingLinkSent:
      mergedData.flags.bookingLinkSent || historyText.includes(company.bookingUrl),
    priceQuoted: mergedData.flags.priceQuoted || /\$[0-9]/.test(historyText),
  };
  const stage = determineStage(mergedData, extraction);
  const intent = extraction.intent || existingState?.intent;

  const updatedState = await storage.createOrUpdateWorkflowState({
    conversationId: conversation.id,
    stage,
    intent,
    data: mergedData,
  });

  const readyToBook =
    conversation.readyToBook ||
    extraction.booking_intent ||
    extraction.schedule_request;

  if (readyToBook && !conversation.readyToBook) {
    notifyReadyToBook(conversation.phone, extraction.notes).catch((err) =>
      console.error("Error notifying owner about ready-to-book customer:", err),
    );
  }

  let updatedConversation = conversation;
  if (readyToBook || extraction.opt_out) {
    updatedConversation = await storage.updateConversation(conversation.phone, {
      readyToBook: readyToBook || conversation.readyToBook,
      bookingNotes: extraction.notes || conversation.bookingNotes,
      aiEnabled: extraction.opt_out ? false : conversation.aiEnabled,
    });
  }

  return {
    context: buildWorkflowContext(
      updatedState.stage as WorkflowStage,
      updatedState.intent as WorkflowIntent | undefined,
      updatedState.data,
    ),
    conversation: updatedConversation,
  };
}

export async function markWorkflowOutbound(
  conversationId: string,
  responseText: string,
  context?: WorkflowContext,
): Promise<void> {
  const state = await storage.getWorkflowStateByConversationId(conversationId);
  if (!state) return;

  const data = normalizeWorkflowData(state.data);
  const bookingLinkSent =
    data.flags.bookingLinkSent || responseText.includes(company.bookingUrl);
  const priceQuoted =
    data.flags.priceQuoted ||
    context?.stage === "quote" ||
    /\$[0-9]/.test(responseText);

  if (bookingLinkSent === data.flags.bookingLinkSent && priceQuoted === data.flags.priceQuoted) {
    return;
  }

  await storage.updateWorkflowState(conversationId, {
    data: {
      ...data,
      flags: {
        ...data.flags,
        bookingLinkSent,
        priceQuoted,
      },
    },
  });
}

export async function markWorkflowBooked(
  conversationId: string,
): Promise<void> {
  const state = await storage.getWorkflowStateByConversationId(conversationId);
  const data = normalizeWorkflowData(state?.data);
  const intent = state?.intent ? (state.intent as WorkflowIntent) : undefined;

  await storage.createOrUpdateWorkflowState({
    conversationId,
    stage: "booked",
    intent,
    data: {
      ...data,
      flags: {
        ...data.flags,
        booked: true,
      },
    },
  });
}
export async function getWorkflowContextForConversation(conversationId: string): Promise<WorkflowContext | undefined> {
  const state = await storage.getWorkflowStateByConversationId(conversationId);
  if (!state) return undefined;

  const data = normalizeWorkflowData(state.data);
  return buildWorkflowContext(
    state.stage as WorkflowStage,
    state.intent as WorkflowIntent | undefined,
    data
  );
}

// ... existing exports ...
