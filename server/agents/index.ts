import type { Agent } from "../core/agent";
import { LeadAssessorAgent } from "./lead-assessor";
import { WorkflowManagerAgent } from "./workflow-manager";
import { AutoResponderAgent } from "./auto-responder";

/**
 * The list of active agents in the system.
 * Agents are executed in the order defined here.
 * 
 * To add a new capability:
 * 1. Create a new agent file in this directory
 * 2. Import it here
 * 3. Add it to this array
 */
export const REGISTERED_AGENTS: Agent[] = [
    // 1. First, analyze the intent and update the state machine
    WorkflowManagerAgent,

    // 2. Then, assess the quality of the lead based on the new info
    LeadAssessorAgent,

    // 3. Finally, decide if we should send an auto-reply
    AutoResponderAgent,
];
