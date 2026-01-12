import type { Agent, AgentMessageContext, AgentCallContext } from "./agent";

/**
 * Registry to manage and orchestrate all active agents.
 * The core system calls this registry, which then multicasts events to plugins.
 */
export class AgentRegistry {
    private static instance: AgentRegistry;
    private agents: Agent[] = [];

    private constructor() { }

    public static getInstance(): AgentRegistry {
        if (!AgentRegistry.instance) {
            AgentRegistry.instance = new AgentRegistry();
        }
        return AgentRegistry.instance;
    }

    /**
     * Register a new agent with the system.
     */
    public register(agent: Agent) {
        console.log(`[AgentRegistry] Registering agent: ${agent.name} (${agent.id})`);
        this.agents.push(agent);
    }

    /**
     * Register multiple agents at once.
     */
    public registerAll(agents: Agent[]) {
        agents.forEach(a => this.register(a));
    }

    /**
     * Dispatch a message received event to all agents.
     * Agents are executed sequentially in order of registration.
     */
    public async dispatchMessage(context: AgentMessageContext): Promise<void> {
        console.log(`[AgentRegistry] Dispatching message event to ${this.agents.length} agents`);

        for (const agent of this.agents) {
            if (agent.onMessageReceived) {
                try {
                    await agent.onMessageReceived(context);
                } catch (error) {
                    console.error(`[AgentRegistry] Agent '${agent.id}' failed handling message:`, error);
                    // We intentionally continue to the next agent even if one fails
                }
            }
        }
    }

    /**
     * Dispatch a call received event to all agents.
     */
    public async dispatchCall(context: AgentCallContext): Promise<void> {
        console.log(`[AgentRegistry] Dispatching call event to ${this.agents.length} agents`);

        for (const agent of this.agents) {
            if (agent.onCallReceived) {
                try {
                    await agent.onCallReceived(context);
                } catch (error) {
                    console.error(`[AgentRegistry] Agent '${agent.id}' failed handling call:`, error);
                }
            }
        }
    }

    /**
     * Get list of active agents for debugging/API visibility.
     */
    public getActiveAgents() {
        return this.agents.map(a => ({ id: a.id, name: a.name, description: a.description }));
    }
}

export const registry = AgentRegistry.getInstance();
