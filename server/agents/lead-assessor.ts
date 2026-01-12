import type { Agent, AgentMessageContext } from "../core/agent";
import { triggerLeadAssessment } from "../services/ai-workflow";

export const LeadAssessorAgent: Agent = {
    id: "lead-assessor",
    name: "Lead Probability Assessor",
    description: "Analyzes conversation history to estimate lead value, probability, and sentiment.",

    async onMessageReceived(context: AgentMessageContext) {
        const { conversation } = context;

        // Trigger the assessment (which handles its own deduplication/pending state checks)
        triggerLeadAssessment(conversation.phone).catch((err) =>
            console.error("[LeadAssessor] Error triggering assessment:", err),
        );
    },
};
