import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("5000"),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_API_KEY: z.string().min(1),
  TWILIO_API_SECRET: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
  TWILIO_CONVERSATIONS_API_KEY: z.string().min(1),
  TWILIO_CONVERSATIONS_API_SECRET: z.string().min(1),
  TWILIO_CONVERSATIONS_SERVICE_SID: z.string().optional(),
  TWILIO_FORWARD_TO_NUMBER: z.string().optional(),
  TWILIO_FORWARD_TIMEOUT_SECONDS: z.string().default("30"),
  TWILIO_CALL_MIN_DURATION_SECONDS: z.string().default("20"),
  AI_INTEGRATIONS_OPENAI_BASE_URL: z.string().url().optional(),
  AI_INTEGRATIONS_OPENAI_API_KEY: z.string().min(1).optional(),
  AI_REPLY_DEBOUNCE_MS: z.string().default("8000"),
  BUSINESS_OWNER_READY_TO_BOOK_PHONE: z.string().optional(),
  PRIMARY_OPERATOR_PHONE: z.string().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  PUBLIC_BOOKING_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(), // For Whisper transcription
  INTEGRATION_API_KEY: z.string().optional(),
});

const rawEnv = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
  TWILIO_API_SECRET: process.env.TWILIO_API_SECRET ?? process.env.TWILIO_API_KEY_SECRET,
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

const callForwardTimeoutSeconds = Number.parseInt(
  parsed.data.TWILIO_FORWARD_TIMEOUT_SECONDS,
  10,
);
const callMinDurationSeconds = Number.parseInt(
  parsed.data.TWILIO_CALL_MIN_DURATION_SECONDS,
  10,
);
const aiReplyDebounceMs = Number.parseInt(parsed.data.AI_REPLY_DEBOUNCE_MS, 10);

export const env = {
  ...parsed.data,
  callForwardTimeoutSeconds: Number.isNaN(callForwardTimeoutSeconds)
    ? 30
    : callForwardTimeoutSeconds,
  callMinDurationSeconds: Number.isNaN(callMinDurationSeconds)
    ? 20
    : callMinDurationSeconds,
  aiReplyDebounceMs: Number.isNaN(aiReplyDebounceMs) ? 8000 : aiReplyDebounceMs,
  isProduction: parsed.data.NODE_ENV === "production",
};
