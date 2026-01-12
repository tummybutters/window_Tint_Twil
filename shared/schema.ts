import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, uniqueIndex, jsonb, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Conversations table - one per phone number
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").notNull().unique(),
  conversationSid: text("conversation_sid").unique(), // Twilio Conversation SID
  name: text("name"),
  lastMessage: text("last_message"),
  lastActivity: timestamp("last_activity").notNull().defaultNow(),
  unreadCount: text("unread_count").default("0"),
  aiEnabled: boolean("ai_enabled").notNull().default(true), // AI auto-responder toggle
  readyToBook: boolean("ready_to_book").default(false), // Booking readiness flag
  bookingNotes: text("booking_notes"), // AI reviewer notes about booking readiness
  callSuppressedAt: timestamp("call_suppressed_at"), // Timestamp of last answered call that disabled AI
  needsReply: boolean("needs_reply").notNull().default(false), // True when latest message is from customer
});

// Messages table
export const messages = pgTable(
  "messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id").notNull(),
    text: text("text").notNull(),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
    direction: text("direction").notNull(), // 'inbound' | 'outbound'
    status: text("status").default("sent"), // 'sending' | 'sent' | 'failed'
    mediaUrl: text("media_url"), // URL to media attachment (image/video)
    mediaType: text("media_type"), // MIME type (e.g., 'image/jpeg', 'image/png')
    externalId: text("external_id"), // Twilio MessageSid or external idempotency key
    source: text("source"), // 'twilio-sms' | 'twilio-conversations' | 'n8n' | 'dashboard' | 'ai'
  },
  (table) => ({
    externalSourceUnique: uniqueIndex("messages_external_id_source_unique").on(
      table.externalId,
      table.source,
    ),
  }),
);

// Lead assessments table
export const leadAssessments = pgTable("lead_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().unique(),
  stage: text("stage"),
  probability: text("probability"),
  estValue: text("est_value"),
  sentiment: text("sentiment"), // 'Positive' | 'Neutral' | 'Negative'
  vehicleInfo: text("vehicle_info"),
  tintPreference: text("tint_preference"),
  coverage: text("coverage"),
  notes: text("notes"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export type WorkflowStage =
  | "new"
  | "service"
  | "vehicle"
  | "location"
  | "quote"
  | "schedule"
  | "booking_link"
  | "booked"
  | "handoff";

export type WorkflowIntent =
  | "info"
  | "pricing"
  | "booking"
  | "schedule"
  | "reschedule"
  | "cancel"
  | "complaint"
  | "call_request"
  | "stop"
  | "other";

export type WorkflowProfile = {
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string; // Street address
  city?: string;
  location?: string; // General area/region
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleType?: string; // car, truck, suv, van, commercial
  coverageWanted?: string; // full, sides_rear, windshield, strip
  primaryConcern?: string; // heat, privacy, uv_protection, legal, appearance
  tintPercentage?: string;
  tintType?: string;
  budget?: string;
  preferredDay?: string;
  preferredTime?: string;
  notes?: string;
};

export type WorkflowFlags = {
  priceQuoted?: boolean;
  bookingLinkSent?: boolean;
  booked?: boolean;
  optOut?: boolean;
};

export type WorkflowData = {
  profile: WorkflowProfile;
  flags: WorkflowFlags;
  lastIntent?: WorkflowIntent;
  notes?: string;
};

export const workflowStates = pgTable("workflow_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .unique()
    .references(() => conversations.id, { onDelete: "cascade" }),
  stage: text("stage").notNull().default("new"),
  intent: text("intent"),
  data: jsonb("data").$type<WorkflowData>().notNull().default(sql`'{}'::jsonb`),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const bookings = pgTable(
  "bookings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerBookingId: text("provider_booking_id"),
    status: text("status").default("confirmed"),
    startTime: timestamp("start_time"),
    endTime: timestamp("end_time"),
    timezone: text("timezone"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    jobValue: decimal("job_value", { precision: 10, scale: 2 }), // Actual revenue from this job
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    providerBookingUnique: uniqueIndex("bookings_provider_booking_unique").on(
      table.provider,
      table.providerBookingId,
    ),
  }),
);

// Call transcription data extracted by AI
export type CallExtractedData = {
  address?: string;
  city?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleType?: string;
  serviceRequested?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  priceDiscussed?: string;
  notes?: string;
};

// Calls table - for recording and transcription
export const calls = pgTable(
  "calls",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    callSid: text("call_sid").unique(), // Twilio Call SID
    direction: text("direction").notNull(), // 'inbound' | 'outbound'
    status: text("status"), // 'completed' | 'missed' | 'busy' | 'no-answer' | 'failed'
    durationSeconds: integer("duration_seconds"),
    recordingUrl: text("recording_url"),
    recordingSid: text("recording_sid"),
    transcript: text("transcript"), // Full transcript from Whisper
    extractedData: jsonb("extracted_data").$type<CallExtractedData>().default(sql`'{}'::jsonb`),
    transcriptionStatus: text("transcription_status").default("pending"), // 'pending' | 'processing' | 'completed' | 'failed'
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    callSidUnique: uniqueIndex("calls_call_sid_unique").on(table.callSid),
  }),
);

// Insert schemas
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
});

export const insertLeadAssessmentSchema = createInsertSchema(leadAssessments).omit({
  id: true,
});

export const insertWorkflowStateSchema = createInsertSchema(workflowStates).omit({
  id: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
});

export const insertCallSchema = createInsertSchema(calls).omit({
  id: true,
});

// Types
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertLeadAssessment = z.infer<typeof insertLeadAssessmentSchema>;
export type LeadAssessment = typeof leadAssessments.$inferSelect;

export type InsertWorkflowState = z.infer<typeof insertWorkflowStateSchema>;
export type WorkflowState = typeof workflowStates.$inferSelect;

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;

// Additional types for frontend
export type ConversationWithAssessment = Conversation & {
  assessment?: LeadAssessment;
};

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sending' | 'sent' | 'failed';
export type Sentiment = 'Positive' | 'Neutral' | 'Negative';
