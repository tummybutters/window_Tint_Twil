import {
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type LeadAssessment,
  type InsertLeadAssessment,
  type ConversationWithAssessment,
  type WorkflowState,
  type WorkflowData,
  type WorkflowIntent,
  type WorkflowStage,
  type Booking,
  type InsertBooking,
  type Call,
  type CallExtractedData,
} from "@shared/schema";
import { supabase } from "./lib/supabase";

type WorkflowStateInput = {
  conversationId: string;
  stage: WorkflowStage;
  intent?: WorkflowIntent;
  data: WorkflowData;
};

type WorkflowStateUpdate = Partial<WorkflowStateInput>;

type CreateCallInput = {
  conversationId: string;
  callSid?: string | null;
  direction: string;
  status?: string | null;
  durationSeconds?: number | null;
  recordingUrl?: string | null;
  recordingSid?: string | null;
  transcript?: string | null;
  extractedData?: CallExtractedData | null;
  transcriptionStatus?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
};

type UpdateCallInput = Partial<CreateCallInput>;

export interface IStorage {
  // Conversations
  getAllConversations(): Promise<ConversationWithAssessment[]>;
  getConversationByPhone(phone: string): Promise<Conversation | undefined>;
  getConversationById(id: string): Promise<Conversation | undefined>;
  getConversationBySid(conversationSid: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  upsertConversationByPhone(
    insertConversation: InsertConversation,
    updates: Partial<InsertConversation>,
  ): Promise<Conversation>;
  updateConversation(phone: string, updates: Partial<InsertConversation>): Promise<Conversation>;
  updateConversationBySid(conversationSid: string, updates: Partial<InsertConversation>): Promise<Conversation>;
  deleteConversation(phone: string): Promise<void>;

  // Messages
  getMessagesByConversationId(conversationId: string): Promise<Message[]>;
  getMessagesByPhone(phone: string): Promise<Message[]>;
  getMessageByExternalId(source: string, externalId: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(messageId: string, status: string): Promise<Message>;

  // Lead Assessments
  getAssessmentByConversationId(conversationId: string): Promise<LeadAssessment | undefined>;
  getAssessmentByPhone(phone: string): Promise<LeadAssessment | undefined>;
  createOrUpdateAssessment(assessment: InsertLeadAssessment): Promise<LeadAssessment>;

  // Workflow States
  getWorkflowStateByConversationId(conversationId: string): Promise<WorkflowState | undefined>;
  createOrUpdateWorkflowState(state: WorkflowStateInput): Promise<WorkflowState>;
  updateWorkflowState(conversationId: string, updates: WorkflowStateUpdate): Promise<WorkflowState>;

  // Bookings
  getBookingsByConversationId(conversationId: string): Promise<Booking[]>;
  getBookingByProviderId(
    provider: string,
    providerBookingId: string,
  ): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBookingJobValue(bookingId: string, jobValue: string): Promise<Booking>;

  // Calls
  getCallsByConversationId(conversationId: string): Promise<Call[]>;
  getCallByCallSid(callSid: string): Promise<Call | undefined>;
  createCall(call: CreateCallInput): Promise<Call>;
  updateCall(callId: string, updates: UpdateCallInput): Promise<Call>;
  updateCallTranscription(
    callId: string,
    transcript: string,
    extractedData: CallExtractedData,
  ): Promise<Call>;
}

// Helper to convert snake_case (DB) to camelCase (App)
function fromDb<T>(row: any): T {
  if (!row) return row;
  const res: any = {};
  for (const key in row) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    res[camelKey] = row[key];
  }
  return res as T;
}

// Helper to convert camelCase (App) to snake_case (DB)
function toDb(obj: any): any {
  if (!obj) return obj;
  const res: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    res[snakeKey] = obj[key];
  }
  return res;
}

export class DatabaseStorage implements IStorage {
  // Conversations
  async getAllConversations(): Promise<ConversationWithAssessment[]> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*, lead_assessments(*)")
      .order("last_activity", { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => {
      const { lead_assessments, ...conv } = row;
      return {
        ...fromDb<Conversation>(conv),
        assessment: lead_assessments ? fromDb<LeadAssessment>(lead_assessments) : undefined,
      };
    });
  }

  async getConversationByPhone(phone: string): Promise<Conversation | undefined> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (error) throw error;
    return data ? fromDb<Conversation>(data) : undefined;
  }

  async getConversationById(id: string): Promise<Conversation | undefined> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? fromDb<Conversation>(data) : undefined;
  }

  async getConversationBySid(conversationSid: string): Promise<Conversation | undefined> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("conversation_sid", conversationSid)
      .maybeSingle();

    if (error) throw error;
    return data ? fromDb<Conversation>(data) : undefined;
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .insert(toDb(insertConversation))
      .select()
      .single();

    if (error) throw error;
    return fromDb<Conversation>(data);
  }

  async upsertConversationByPhone(
    insertConversation: InsertConversation,
    updates: Partial<InsertConversation>,
  ): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .upsert(
        { ...toDb(insertConversation), phone: insertConversation.phone },
        { onConflict: "phone" }
      )
      .select()
      .single();

    if (error) throw error;
    return fromDb<Conversation>(data);
  }

  async updateConversation(phone: string, updates: Partial<InsertConversation>): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .update(toDb(updates))
      .eq("phone", phone)
      .select()
      .single();

    if (error) throw error;
    return fromDb<Conversation>(data);
  }

  async updateConversationBySid(conversationSid: string, updates: Partial<InsertConversation>): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .update(toDb(updates))
      .eq("conversation_sid", conversationSid)
      .select()
      .single();

    if (error) throw error;
    return fromDb<Conversation>(data);
  }

  async deleteConversation(phone: string): Promise<void> {
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("phone", phone);

    if (error) throw error;
  }

  // Messages
  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: true });

    if (error) throw error;
    return (data || []).map(fromDb<Message>);
  }

  async getMessagesByPhone(phone: string): Promise<Message[]> {
    const conv = await this.getConversationByPhone(phone);
    if (!conv) return [];
    return this.getMessagesByConversationId(conv.id);
  }

  async getMessageByExternalId(source: string, externalId: string): Promise<Message | undefined> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("source", source)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) throw error;
    return data ? fromDb<Message>(data) : undefined;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const { data, error } = await supabase
      .from("messages")
      .insert(toDb(insertMessage))
      .select()
      .single();

    if (error) throw error;
    return fromDb<Message>(data);
  }

  async updateMessageStatus(messageId: string, status: string): Promise<Message> {
    const { data, error } = await supabase
      .from("messages")
      .update({ status })
      .eq("id", messageId)
      .select()
      .single();

    if (error) throw error;
    return fromDb<Message>(data);
  }

  // Lead Assessments
  async getAssessmentByConversationId(conversationId: string): Promise<LeadAssessment | undefined> {
    const { data, error } = await supabase
      .from("lead_assessments")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (error) throw error;
    return data ? fromDb<LeadAssessment>(data) : undefined;
  }

  async getAssessmentByPhone(phone: string): Promise<LeadAssessment | undefined> {
    const conv = await this.getConversationByPhone(phone);
    if (!conv) return undefined;
    return this.getAssessmentByConversationId(conv.id);
  }

  async createOrUpdateAssessment(insertAssessment: InsertLeadAssessment): Promise<LeadAssessment> {
    const { data, error } = await supabase
      .from("lead_assessments")
      .upsert(
        { ...toDb(insertAssessment), conversation_id: insertAssessment.conversationId },
        { onConflict: "conversation_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return fromDb<LeadAssessment>(data);
  }

  // Workflow States
  async getWorkflowStateByConversationId(conversationId: string): Promise<WorkflowState | undefined> {
    const { data, error } = await supabase
      .from("workflow_states")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (error) throw error;
    return data ? fromDb<WorkflowState>(data) : undefined;
  }

  async createOrUpdateWorkflowState(state: WorkflowStateInput): Promise<WorkflowState> {
    const { data, error } = await supabase
      .from("workflow_states")
      .upsert(
        { ...toDb(state), conversation_id: state.conversationId },
        { onConflict: "conversation_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return fromDb<WorkflowState>(data);
  }

  async updateWorkflowState(conversationId: string, updates: WorkflowStateUpdate): Promise<WorkflowState> {
    const { data, error } = await supabase
      .from("workflow_states")
      .update(toDb(updates))
      .eq("conversation_id", conversationId)
      .select()
      .single();

    if (error) throw error;
    return fromDb<WorkflowState>(data);
  }

  // Bookings
  async getBookingsByConversationId(conversationId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(fromDb<Booking>);
  }

  async getBookingByProviderId(provider: string, providerBookingId: string): Promise<Booking | undefined> {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("provider", provider)
      .eq("provider_booking_id", providerBookingId)
      .maybeSingle();

    if (error) throw error;
    return data ? fromDb<Booking>(data) : undefined;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const { data, error } = await supabase
      .from("bookings")
      .insert(toDb(insertBooking))
      .select()
      .single();

    if (error) throw error;
    return fromDb<Booking>(data);
  }

  async updateBookingJobValue(bookingId: string, jobValue: string): Promise<Booking> {
    const { data, error } = await supabase
      .from("bookings")
      .update({ job_value: jobValue })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) throw error;
    return fromDb<Booking>(data);
  }

  // Calls
  async getCallsByConversationId(conversationId: string): Promise<Call[]> {
    const { data, error } = await supabase
      .from("calls")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(fromDb<Call>);
  }

  async getCallByCallSid(callSid: string): Promise<Call | undefined> {
    const { data, error } = await supabase
      .from("calls")
      .select("*")
      .eq("call_sid", callSid)
      .maybeSingle();

    if (error) throw error;
    return data ? fromDb<Call>(data) : undefined;
  }

  async createCall(insertCall: CreateCallInput): Promise<Call> {
    const { data, error } = await supabase
      .from("calls")
      .insert(toDb(insertCall))
      .select()
      .single();

    if (error) throw error;
    return fromDb<Call>(data);
  }

  async updateCall(callId: string, updates: UpdateCallInput): Promise<Call> {
    const { data, error } = await supabase
      .from("calls")
      .update(toDb(updates))
      .eq("id", callId)
      .select()
      .single();

    if (error) throw error;
    return fromDb<Call>(data);
  }

  async updateCallTranscription(callId: string, transcript: string, extractedData: CallExtractedData): Promise<Call> {
    const { data, error } = await supabase
      .from("calls")
      .update({
        transcript,
        extracted_data: extractedData,
        transcription_status: "completed",
      })
      .eq("id", callId)
      .select()
      .single();

    if (error) throw error;
    return fromDb<Call>(data);
  }
}

export const storage = new DatabaseStorage();
