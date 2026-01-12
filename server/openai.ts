import OpenAI from "openai";
import { env } from "./config/env";
import {
  tintBookingReviewPrompt,
  tintLeadAssessmentPrompt,
  tintWorkflowExtractionPrompt,
} from "./config/prompts";
import type { WorkflowIntent, WorkflowProfile } from "@shared/schema";

const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY || env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://obsidianautoworksoc.com", // Optional, for including your app on openrouter.ai rankings.
    "X-Title": "Obsidian Auto Works Agent", // Optional. Shows in rankings on openrouter.ai.
  },
});

interface LeadAssessmentResult {
  stage: string;
  probability: string;
  est_value: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  vehicle_info: string;
  tint_preference: string;
  coverage: string;
  notes: string;
  last_message: string;
  last_activity: string;
}

interface BookingReviewResult {
  escalate: boolean;
  last_message: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}

interface WorkflowExtractionResult {
  intent: WorkflowIntent;
  booking_intent: boolean;
  schedule_request: boolean;
  call_request: boolean;
  opt_out: boolean;
  profile: {
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
  notes: string;
}

function sanitizeJsonResponse(content: string): string {
  return content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
}

function normalizeIntent(intent?: string): WorkflowIntent {
  switch (intent) {
    case "info":
    case "pricing":
    case "booking":
    case "schedule":
    case "reschedule":
    case "cancel":
    case "complaint":
    case "call_request":
    case "stop":
    case "other":
      return intent;
    default:
      return "other";
  }
}

function normalizeExtraction(
  raw: Partial<WorkflowExtractionResult>,
): WorkflowExtractionResult {
  const profile = raw.profile ?? {
    full_name: "",
    phone: "",
    location: "",
    vehicle_year: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_type: "",
    tint_type: "",
    coverage_wanted: "",
    primary_concern: "",
    budget: "",
    preferred_day: "",
    preferred_time: "",
    notes: "",
  };

  return {
    intent: normalizeIntent(raw.intent),
    booking_intent: Boolean(raw.booking_intent),
    schedule_request: Boolean(raw.schedule_request),
    call_request: Boolean(raw.call_request),
    opt_out: Boolean(raw.opt_out),
    profile: {
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      location: profile.location || "",
      vehicle_year: profile.vehicle_year || "",
      vehicle_make: profile.vehicle_make || "",
      vehicle_model: profile.vehicle_model || "",
      vehicle_type: profile.vehicle_type || "",
      tint_type: profile.tint_type || "",
      coverage_wanted: profile.coverage_wanted || "",
      primary_concern: profile.primary_concern || "",
      budget: profile.budget || "",
      preferred_day: profile.preferred_day || "",
      preferred_time: profile.preferred_time || "",
      notes: profile.notes || "",
    },
    notes: raw.notes || "",
  };
}

export async function analyzeLeadAssessment(
  conversationHistory: string,
): Promise<LeadAssessmentResult> {
  const systemPrompt = tintLeadAssessmentPrompt;

  try {
    if (!env.AI_INTEGRATIONS_OPENAI_BASE_URL || !env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error("OpenAI credentials not configured");
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: conversationHistory }
      ],
      temperature: 0.7,
      max_completion_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean up content: remove code fences and backticks if present
    const cleanedContent = sanitizeJsonResponse(content);
    const result = JSON.parse(cleanedContent) as LeadAssessmentResult;
    return result;
  } catch (error) {
    console.error('Error analyzing lead assessment:', error);
    throw error;
  }
}

export async function reviewMessageForBooking(
  lastMessage: string,
): Promise<BookingReviewResult> {
  const systemPrompt = tintBookingReviewPrompt;

  try {
    if (!env.AI_INTEGRATIONS_OPENAI_BASE_URL || !env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error("OpenAI credentials not configured");
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Review this customer message: "${lastMessage}"` }
      ],
      temperature: 0.3,
      max_completion_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean up content: remove code fences and backticks if present
    const cleanedContent = sanitizeJsonResponse(content);

    const result = JSON.parse(cleanedContent) as BookingReviewResult;
    return result;
  } catch (error) {
    console.error('Error reviewing message for booking:', error);
    throw error;
  }
}

export async function extractWorkflowSignals(
  conversationHistory: string,
  knownProfile?: WorkflowProfile,
): Promise<WorkflowExtractionResult> {
  const systemPrompt = tintWorkflowExtractionPrompt;

  try {
    if (!env.AI_INTEGRATIONS_OPENAI_BASE_URL || !env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error("OpenAI credentials not configured");
    }

    const context = knownProfile
      ? `Known profile (do not infer missing fields): ${JSON.stringify(knownProfile)}`
      : "Known profile (do not infer missing fields): {}";

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${context}\n\nConversation:\n${conversationHistory}`,
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 700,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const cleanedContent = sanitizeJsonResponse(content);
    const parsed = JSON.parse(cleanedContent) as Partial<WorkflowExtractionResult>;
    return normalizeExtraction(parsed);
  } catch (error) {
    console.error("Error extracting workflow signals:", error);
    throw error;
  }
}
