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
  conversations,
  messages,
  leadAssessments,
  workflowStates,
  bookings,
  calls
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and } from "drizzle-orm";

type WorkflowStateInput = {
  conversationId: string;
  stage: WorkflowStage;
  intent?: WorkflowIntent;
  data: WorkflowData;
};

type WorkflowStateUpdate = Partial<WorkflowStateInput>;

// Custom type for creating calls to avoid JSONB type inference issues
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

export class DatabaseStorage implements IStorage {
  // Conversations
  async getAllConversations(): Promise<ConversationWithAssessment[]> {
    const result = await db
      .select({
        conversation: conversations,
        assessment: leadAssessments
      })
      .from(conversations)
      .leftJoin(leadAssessments, eq(conversations.id, leadAssessments.conversationId))
      .orderBy(desc(conversations.lastActivity));

    return result.map(row => ({
      ...row.conversation,
      assessment: row.assessment || undefined
    }));
  }

  async getConversationByPhone(phone: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.phone, phone));
    return conversation || undefined;
  }

  async getConversationById(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationBySid(conversationSid: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.conversationSid, conversationSid));
    return conversation || undefined;
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values(insertConversation)
      .returning();
    return conversation;
  }

  async upsertConversationByPhone(
    insertConversation: InsertConversation,
    updates: Partial<InsertConversation>,
  ): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values(insertConversation)
      .onConflictDoUpdate({
        target: conversations.phone,
        set: updates,
      })
      .returning();
    return conversation;
  }

  async updateConversation(phone: string, updates: Partial<InsertConversation>): Promise<Conversation> {
    const [conversation] = await db
      .update(conversations)
      .set(updates)
      .where(eq(conversations.phone, phone))
      .returning();
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  }

  async updateConversationBySid(conversationSid: string, updates: Partial<InsertConversation>): Promise<Conversation> {
    const [conversation] = await db
      .update(conversations)
      .set(updates)
      .where(eq(conversations.conversationSid, conversationSid))
      .returning();
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  }

  async deleteConversation(phone: string): Promise<void> {
    const conversation = await this.getConversationByPhone(phone);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    await db.delete(leadAssessments).where(eq(leadAssessments.conversationId, conversation.id));
    await db.delete(messages).where(eq(messages.conversationId, conversation.id));
    await db.delete(conversations).where(eq(conversations.phone, phone));
  }

  // Messages
  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.timestamp));
  }

  async getMessagesByPhone(phone: string): Promise<Message[]> {
    const conversation = await this.getConversationByPhone(phone);
    if (!conversation) return [];
    return this.getMessagesByConversationId(conversation.id);
  }

  async getMessageByExternalId(source: string, externalId: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.externalId, externalId), eq(messages.source, source)));
    return message || undefined;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async updateMessageStatus(messageId: string, status: string): Promise<Message> {
    const [message] = await db
      .update(messages)
      .set({ status })
      .where(eq(messages.id, messageId))
      .returning();
    
    if (!message) {
      throw new Error('Message not found');
    }
    return message;
  }

  // Lead Assessments
  async getAssessmentByConversationId(conversationId: string): Promise<LeadAssessment | undefined> {
    const [assessment] = await db
      .select()
      .from(leadAssessments)
      .where(eq(leadAssessments.conversationId, conversationId));
    return assessment || undefined;
  }

  async getAssessmentByPhone(phone: string): Promise<LeadAssessment | undefined> {
    const conversation = await this.getConversationByPhone(phone);
    if (!conversation) return undefined;
    return this.getAssessmentByConversationId(conversation.id);
  }

  async createOrUpdateAssessment(insertAssessment: InsertLeadAssessment): Promise<LeadAssessment> {
    const existing = await this.getAssessmentByConversationId(insertAssessment.conversationId);
    
    if (existing) {
      const [updated] = await db
        .update(leadAssessments)
        .set({
          ...insertAssessment,
          lastUpdated: new Date()
        })
        .where(eq(leadAssessments.conversationId, insertAssessment.conversationId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(leadAssessments)
        .values(insertAssessment)
        .returning();
      return created;
    }
  }

  // Workflow States
  async getWorkflowStateByConversationId(
    conversationId: string,
  ): Promise<WorkflowState | undefined> {
    const [state] = await db
      .select()
      .from(workflowStates)
      .where(eq(workflowStates.conversationId, conversationId));
    return state || undefined;
  }

  async createOrUpdateWorkflowState(
    insertState: WorkflowStateInput,
  ): Promise<WorkflowState> {
    const existing = await this.getWorkflowStateByConversationId(insertState.conversationId);

    if (existing) {
      const [updated] = await db
        .update(workflowStates)
        .set({
          ...insertState,
          lastUpdated: new Date(),
        })
        .where(eq(workflowStates.conversationId, insertState.conversationId))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(workflowStates)
      .values(insertState)
      .returning();
    return created;
  }

  async updateWorkflowState(
    conversationId: string,
    updates: WorkflowStateUpdate,
  ): Promise<WorkflowState> {
    const [updated] = await db
      .update(workflowStates)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(workflowStates.conversationId, conversationId))
      .returning();

    if (!updated) {
      throw new Error("Workflow state not found");
    }
    return updated;
  }

  // Bookings
  async getBookingsByConversationId(conversationId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.conversationId, conversationId))
      .orderBy(desc(bookings.createdAt));
  }

  async getBookingByProviderId(
    provider: string,
    providerBookingId: string,
  ): Promise<Booking | undefined> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.provider, provider), eq(bookings.providerBookingId, providerBookingId)));
    return booking || undefined;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values(insertBooking)
      .returning();
    return booking;
  }

  async updateBookingJobValue(bookingId: string, jobValue: string): Promise<Booking> {
    const [booking] = await db
      .update(bookings)
      .set({ jobValue })
      .where(eq(bookings.id, bookingId))
      .returning();

    if (!booking) {
      throw new Error("Booking not found");
    }
    return booking;
  }

  // Calls
  async getCallsByConversationId(conversationId: string): Promise<Call[]> {
    return await db
      .select()
      .from(calls)
      .where(eq(calls.conversationId, conversationId))
      .orderBy(desc(calls.createdAt));
  }

  async getCallByCallSid(callSid: string): Promise<Call | undefined> {
    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.callSid, callSid));
    return call || undefined;
  }

  async createCall(insertCall: CreateCallInput): Promise<Call> {
    const [call] = await db
      .insert(calls)
      .values(insertCall as typeof calls.$inferInsert)
      .returning();
    return call;
  }

  async updateCall(callId: string, updates: UpdateCallInput): Promise<Call> {
    const [call] = await db
      .update(calls)
      .set(updates as Partial<typeof calls.$inferInsert>)
      .where(eq(calls.id, callId))
      .returning();

    if (!call) {
      throw new Error("Call not found");
    }
    return call;
  }

  async updateCallTranscription(
    callId: string,
    transcript: string,
    extractedData: CallExtractedData,
  ): Promise<Call> {
    const [call] = await db
      .update(calls)
      .set({
        transcript,
        extractedData,
        transcriptionStatus: "completed",
      })
      .where(eq(calls.id, callId))
      .returning();

    if (!call) {
      throw new Error("Call not found");
    }
    return call;
  }
}

export const storage = new DatabaseStorage();
