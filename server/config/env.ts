import { z } from "zod";

// Hardcoded defaults (not secrets, just config)
const DEFAULTS = {
  PORT: "5000",
  TWILIO_FORWARD_TIMEOUT_SECONDS: 30,
  TWILIO_CALL_MIN_DURATION_SECONDS: 20,
  AI_REPLY_DEBOUNCE_MS: 8000,
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  PUBLIC_BOOKING_URL: "https://obsidianautoworksoc.com/booking.html",
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default(DEFAULTS.PORT),

  // Supabase - required
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  // Twilio - required
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_API_KEY: z.string().min(1),
  TWILIO_API_SECRET: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
  TWILIO_CONVERSATIONS_API_KEY: z.string().min(1),
  TWILIO_CONVERSATIONS_API_SECRET: z.string().min(1),
  TWILIO_CONVERSATIONS_SERVICE_SID: z.string().optional(),

  // Call handling - optional with defaults
  TWILIO_FORWARD_TO_NUMBER: z.string().optional(),

  // AI - at least one required
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),

  // Notifications - optional
  BUSINESS_OWNER_READY_TO_BOOK_PHONE: z.string().optional(),
  PRIMARY_OPERATOR_PHONE: z.string().optional(),

  // Public URLs - optional (uses defaults)
  PUBLIC_APP_URL: z.string().url().optional(),
  PUBLIC_BOOKING_URL: z.string().url().optional(),

  // Legacy/optional (for backwards compatibility)
  AI_INTEGRATIONS_OPENAI_BASE_URL: z.string().url().optional(),
  AI_INTEGRATIONS_OPENAI_API_KEY: z.string().min(1).optional(),
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

export const env = {
  ...parsed.data,

  // Hardcoded defaults
  callForwardTimeoutSeconds: DEFAULTS.TWILIO_FORWARD_TIMEOUT_SECONDS,
  callMinDurationSeconds: DEFAULTS.TWILIO_CALL_MIN_DURATION_SECONDS,
  aiReplyDebounceMs: DEFAULTS.AI_REPLY_DEBOUNCE_MS,
  openRouterBaseUrl: DEFAULTS.OPENROUTER_BASE_URL,

  // Use provided value or default
  publicBookingUrl: parsed.data.PUBLIC_BOOKING_URL ?? DEFAULTS.PUBLIC_BOOKING_URL,

  // Computed
  isProduction: parsed.data.NODE_ENV === "production",
};
