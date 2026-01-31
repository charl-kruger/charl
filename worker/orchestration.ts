import { z } from "zod";
import { tool } from "ai";
import type { Registry } from "./durable-objects/registry";

/**
 * Orchestration Tools
 * These tools are used by the Registry Agent to manage the fleet.
 */
export const orchestrationTools = {
    /**
     * Spawn or wake up an agent with a specific instruction.
     */
    spawn_agent: tool({
        description: "Create or wake up a generic Chat Agent with specific instructions.",
        parameters: z.object({
            name: z.string().describe("Unique name for the agent (kebab-case preferred)"),
            instruction: z.string().describe("Initial system instruction for the agent")
        }),
        execute: async ({ name, instruction }, context: any) => {
            // "agent" here is the Registry instance (because we bind it in the context)
            const registry = context.agent as Registry;
            try {
                // Register it if not exists (upsert)
                await registry.register(name);

                // We can't directly "seed" the agent with an instruction via tools easily without a broadcast or direct call.
                // But we CAN broadcast to it specifically.
                await registry.broadcastToAgent(name, instruction);

                return {
                    success: true,
                    message: `Agent '${name}' spawned/woken and instructed: "${instruction}"`,
                    agentUrl: `/agents/${name}`
                };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        }
    }),

    /**
     * Broadcast a message to all agents.
     */
    broadcast: tool({
        description: "Send a message to ALL registered agents.",
        parameters: z.object({
            message: z.string().describe(" The message or instruction to broadcast")
        }),
        execute: async ({ message }, context: any) => {
            const registry = context.agent as Registry;
            const results = await registry.broadcast(message);
            return {
                success: true,
                results
            };
        }
    }),

    /**
     * Get the current status of the fleet.
     */
    get_fleet_status: tool({
        description: "Get a summary of all registered agents and their last known heartbeats.",
        parameters: z.object({}),
        execute: async (_: any, context: any) => {
            const registry = context.agent as Registry;
            const agents = registry.state.agents;
            const now = Date.now();

            const summary = Object.values(agents).map(a => {
                const secondsSinceSeen = a.lastSeen ? Math.round((now - a.lastSeen) / 1000) : "never";
                return `- ${a.name} (Last seen: ${secondsSinceSeen}s ago)`;
            }).join("\n");

            if (!summary) return "No agents registered.";
            return summary;
        }
    })
};
