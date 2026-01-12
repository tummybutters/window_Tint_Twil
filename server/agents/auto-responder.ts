import type { Agent, AgentMessageContext } from "../core/agent";
import { storage } from "../storage";
import { scheduleAIResponse, cancelPendingAIResponse } from "../services/reply-scheduler";
import { getWorkflowContextForConversation } from "../services/workflow";

export const AutoResponderAgent: Agent = {
    id: "auto-responder",
    name: "AI Auto Responder",
    description: "Automatically generates and sends AI responses based on conversation context and workflow state.",

    async onMessageReceived(context: AgentMessageContext) {
        const { conversation, message } = context;

        // 1. Re-fetch conversation to ensure we have the latest flags (e.g. aiEnabled could have been flipped by WorkflowManager)
        const freshConversation = await storage.getConversationByPhone(conversation.phone);
        if (!freshConversation) return;

        // 2. If AI is disabled, ensure we cancel any pending replies and exit
        if (!freshConversation.aiEnabled) {
            cancelPendingAIResponse(freshConversation.phone);
            console.log(`[AutoResponder] AI disabled for ${freshConversation.phone} - skipping response`);
            return;
        }

        // 3. Ensure we have a valid Twilio channel to reply to
        const conversationSid = freshConversation.conversationSid;
        if (!conversationSid) {
            console.log(`[AutoResponder] No conversationSid for ${freshConversation.phone} - cannot reply`);
            return;
        }

        // 4. Get the latest workflow context so the AI knows what to say (stage, missing info, etc.)
        const workflowContext = await getWorkflowContextForConversation(freshConversation.id);

        // 5. Schedule the response
        // The scheduler handles debouncing (grouping multiple rapid messages)
        scheduleAIResponse({
            phone: freshConversation.phone,
            conversationSid,
            workflowContext,
            expectedLastInboundId: message.id, // Use the ID of the message that triggered this event
        });
    },
};
