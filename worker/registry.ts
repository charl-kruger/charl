import { Agent } from "agents";
import type { AgentEnv } from "./types";

export interface AgentMetadata {
    id: string;
    name: string;
    createdAt: number;
    lastSeen?: number;
}

export interface RegistryState {
    agents: Record<string, AgentMetadata>;
}

/**
 * Registry Agent
 * Maintains a list of all initialized agents in the system.
 * Uses Agents SDK for state management and WebSocket syncing.
 */
export class Registry extends Agent<AgentEnv, RegistryState> {

    // Initial state required by Agent class
    initialState: RegistryState = {
        agents: {}
    };

    /**
     * RPC Method: Register a new agent
     */
    async register(name: string) {
        if (!name) throw new Error("Name is required");

        const { agents } = this.state;
        if (agents[name]) {
            throw new Error("Agent already exists");
        }

        const newAgent: AgentMetadata = {
            id: name,
            name: name,
            createdAt: Date.now(),
            lastSeen: Date.now()
        };

        // Update state - this automatically syncs to connected clients
        this.setState({
            agents: {
                ...agents,
                [name]: newAgent
            }
        });

        return newAgent;
    }

    /**
     * RPC Method: Update agent status
     */
    async heartbeat(name: string) {
        const { agents } = this.state;
        if (!agents[name]) {
            // Optional: Auto-register or throw?
            // For now, silently return or throw. Let's throw.
            // Actually, a heartbeat from an unknown agent could be an auto-registration event?
            // Let's stick to simple "must register first" or simple "update if exists"
            // Ideally heartbeat should be resilient.
            // If agent restarts and sends heartbeat but registry lost it (unlikely with DO persistence),
            // or if agent creates itself but registry doesn't know yet (via manual route?)
            // Let's throw for now to be explicit.
            return false;
        }

        const updatedAgent = {
            ...agents[name],
            lastSeen: Date.now()
        };

        this.setState({
            agents: {
                ...agents,
                [name]: updatedAgent
            }
        });

        return true;
    }

    /**
     * RPC Method: Broadcast to all agents
     */
    async broadcast(message: string) {
        const { agents } = this.state;
        const results: Record<string, string> = {};

        for (const agent of Object.values(agents)) {
            try {
                // @ts-ignore - Dynamic binding
                const chatNamespace = this.env.Chat;
                if (chatNamespace) {
                    const id = chatNamespace.idFromName(agent.name);
                    const stub = chatNamespace.get(id);
                    // Standard fetch broadcast
                    // We could promote Chat to use RPC too, but for now fetch is fine for this direction
                    // as Chat has not been refactored to expose a "receiveBroadcast" RPC method yet.
                    // Wait, Chat handles POST /system/instruction.
                    await stub.fetch("http://internal/system/instruction", {
                        method: "POST",
                        body: JSON.stringify({ message }),
                        headers: { "Content-Type": "application/json" }
                    });
                    results[agent.name] = "Sent";
                }
            } catch (e) {
                results[agent.name] = `Failed: ${e}`;
            }
        }
        return results;
    }

    // Handle HTTP requests (Legacy/REST support for generic fetch)
    async onRequest(request: Request) {
        const url = new URL(request.url);

        // Allow fetching the list via GET
        if (request.method === "GET" && url.pathname === "/api/registry") {
            const agents = Object.values(this.state.agents).sort(
                (a, b) => b.createdAt - a.createdAt
            );
            return new Response(JSON.stringify(agents), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // Support POST for creation via REST (e.g. from UI if not using RPC)
        if (request.method === "POST" && url.pathname === "/api/registry") {
            const body = await request.json() as { name: string };
            try {
                const agent = await this.register(body.name);
                return new Response(JSON.stringify(agent), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e: any) {
                return new Response(e.message, { status: 400 });
            }
        }

        // Support POST for broadcast via REST
        if (request.method === "POST" && url.pathname.endsWith("/broadcast")) {
            const body = await request.json() as { message: string };
            const results = await this.broadcast(body.message);
            return new Response(JSON.stringify(results), {
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response("Not found", { status: 404 });
    }
}
