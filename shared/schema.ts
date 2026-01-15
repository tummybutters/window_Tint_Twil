import { z } from "zod";

// --- Custom Types ---

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
  address?: string;
  city?: string;
  location?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleType?: string;
  coverageWanted?: string;
  primaryConcern?: string;
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

// --- Conversations ---

export const conversationSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().min(1),
  conversationSid: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  lastMessage: z.string().optional().nullable(),
  lastActivity: z.coerce.date(),
  unreadCount: z.string().default("0"),
  aiEnabled: z.boolean().default(true),
  readyToBook: z.boolean().default(false),
  bookingNotes: z.string().optional().nullable(),
  callSuppressedAt: z.coerce.date().optional().nullable(),
  needsReply: z.boolean().default(false),
});

export const insertConversationSchema = conversationSchema.omit({
  id: true,
  lastActivity: true,
});

export type Conversation = z.infer<typeof conversationSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

// --- Messages ---

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  text: z.string().min(1),
  timestamp: z.coerce.date(),
  direction: z.string(), // 'inbound' | 'outbound'
  status: z.string().default("sent"),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
});

export const insertMessageSchema = messageSchema.omit({
  id: true,
  timestamp: true,
});

export type Message = z.infer<typeof messageSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// --- Lead Assessments ---

export const leadAssessmentSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  stage: z.string().optional().nullable(),
  probability: z.string().optional().nullable(),
  estValue: z.string().optional().nullable(),
  sentiment: z.string().optional().nullable(),
  vehicleInfo: z.string().optional().nullable(),
  tintPreference: z.string().optional().nullable(),
  coverage: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lastUpdated: z.coerce.date(),
});

export const insertLeadAssessmentSchema = leadAssessmentSchema.omit({
  id: true,
  lastUpdated: true,
});

export type LeadAssessment = z.infer<typeof leadAssessmentSchema>;
export type InsertLeadAssessment = z.infer<typeof insertLeadAssessmentSchema>;

// --- Workflow States ---

export const workflowStateSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  stage: z.string().default("new"),
  intent: z.string().optional().nullable(),
  data: z.any(), // WorkflowData
  lastUpdated: z.coerce.date(),
});

export const insertWorkflowStateSchema = workflowStateSchema.omit({
  id: true,
  lastUpdated: true,
});

export type WorkflowState = z.infer<typeof workflowStateSchema>;
export type InsertWorkflowState = z.infer<typeof insertWorkflowStateSchema>;

// --- Bookings ---

export const bookingSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  provider: z.string(),
  providerBookingId: z.string().optional().nullable(),
  status: z.string().default("confirmed"),
  startTime: z.coerce.date().optional().nullable(),
  endTime: z.coerce.date().optional().nullable(),
  timezone: z.string().optional().nullable(),
  payload: z.any(),
  jobValue: z.string().optional().nullable(), // Store as string for decimal
  createdAt: z.coerce.date(),
});

export const insertBookingSchema = bookingSchema.omit({
  id: true,
  createdAt: true,
});

export type Booking = z.infer<typeof bookingSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

// --- Calls ---

export const callSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  callSid: z.string().optional().nullable(),
  direction: z.string(),
  status: z.string().optional().nullable(),
  durationSeconds: z.number().optional().nullable(),
  recordingUrl: z.string().optional().nullable(),
  recordingSid: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  extractedData: z.any().optional().nullable(), // CallExtractedData
  transcriptionStatus: z.string().default("pending"),
  startedAt: z.coerce.date().optional().nullable(),
  endedAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date(),
});

export const insertCallSchema = callSchema.omit({
  id: true,
  createdAt: true,
});

export type Call = z.infer<typeof callSchema>;
export type InsertCall = z.infer<typeof insertCallSchema>;

// --- Joined Types ---

export type ConversationWithAssessment = Conversation & {
  assessment?: LeadAssessment;
};

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sending' | 'sent' | 'failed';
export type Sentiment = 'Positive' | 'Neutral' | 'Negative';
