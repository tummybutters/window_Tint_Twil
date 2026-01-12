import type { Conversation, Message } from "@shared/schema";

/**
 * Context passed to agents when a new message is received.
 * Contains the message content, the associated conversation, and metadata.
 */
export interface AgentMessageContext {
    message: Message;
    conversation: Conversation;
    isNewConversation: boolean;
}

/**
 * Context passed to agents when a voice call is received/handled.
 */
export interface AgentCallContext {
    conversation: Conversation;
    callerNumber: string;
    dialDurationSeconds: number;
    isAnswered: boolean;
}

/**
 * The core Agent interface.
 * Implement this to create a new module that reacts to system events.
 */
export interface Agent {
    /**
     * Unique identifier for the agent (e.g. "lead-assessor").
     * Used for logging and configuration.
     */
    id: string;

    /**
     * Human-readable name (e.g. "Lead Probability Assessor").
     */
    name: string;

    /**
     * Description of what this agent does.
     */
    description: string;

    /**
     * Optional: Hook called when a new inbound message is received.
     * This is where you put logic to analyze, reply, or update state.
     */
    onMessageReceived?(context: AgentMessageContext): Promise<void>;

    /**
     * Optional: Hook called when a voice call status is updated.
     */
    onCallReceived?(context: AgentCallContext): Promise<void>;
}
