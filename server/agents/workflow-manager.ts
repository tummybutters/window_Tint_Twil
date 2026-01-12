import type { Agent, AgentMessageContext } from "../core/agent";
import { updateWorkflowFromInbound } from "../services/workflow";

export const WorkflowManagerAgent: Agent = {
    id: "workflow-manager",
    name: "Workflow Manager",
    description: "Extracts customer intent, updates conversation stage (e.g. 'new' -> 'booked'), and handles notifications.",

    async onMessageReceived(context: AgentMessageContext) {
        const { conversation } = context;

        // We delegate the heavy lifting to the existing robust service logic
        // In a fuller refactor, that logic could move inside this file, but for now 
        // we just want to neatly encapsulate the invocation.
        try {
            await updateWorkflowFromInbound(conversation);
        } catch (error) {
            console.error("[WorkflowManager] Failed to update workflow state:", error);
            throw error; // Re-throw to let registry log it, or handle specific cases
        }
    },
};
