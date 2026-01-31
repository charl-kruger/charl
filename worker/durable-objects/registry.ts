import { AIChatAgent } from "agents/ai-chat-agent";
import type { AgentEnv } from "../types";
import {
    streamText,
    generateId,
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    type StreamTextOnFinishCallback
} from "ai";
// import { openai } from "@ai-sdk/openai";
import { createWorkersAI } from "workers-ai-provider";
import { orchestrationTools } from "../orchestration";

// const model = openai("gpt-4o-2024-11-20");
const modelName = "@cf/meta/llama-3-8b-instruct";

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
 * Intelligent Orchestrator for the Agent Fleet.
 */
export class Registry extends AIChatAgent<AgentEnv, RegistryState> {

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
        const newAgent: AgentMetadata = {
            id: name,
            name: name,
            createdAt: Date.now(),
            lastSeen: Date.now()
        };

        this.setState({
            agents: {
                ...agents,
                [name]: newAgent
            }
        });

        return newAgent;
    }

    /**
     * RPC Method: Spawn/Instruct an agent
     * Combined method for ease of use by MCP and Tools.
     */
    async spawn(name: string, instruction?: string) {
        // Register (or ensure exists)
        try {
            await this.register(name);
        } catch (e: any) {
            // Ignore "already exists" error if we just want to instruct it
            if (e.message !== "Agent already exists") throw e;
        }

        if (instruction) {
            await this.broadcastToAgent(name, instruction);
        }
        return { success: true, name, instruction };
    }

    /**
     * RPC Method: Update agent status
     */
    async heartbeat(name: string) {
        const { agents } = this.state;
        // Auto-register on heartbeat if unknown
        if (!agents[name]) {
            await this.register(name);
            return true;
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
     * Helper: Broadcast message to specific agent
     */
    async broadcastToAgent(name: string, message: string) {
        // @ts-ignore - Dynamic binding
        const chatNamespace = this.env.Chat;
        if (chatNamespace) {
            const id = chatNamespace.idFromName(name);
            const stub = chatNamespace.get(id);
            await stub.fetch("http://internal/system/instruction", {
                method: "POST",
                body: JSON.stringify({ message }),
                headers: { "Content-Type": "application/json" }
            });
            return true;
        }
        throw new Error("Chat binding not found");
    }

    /**
     * RPC Method: Broadcast to all agents
     */
    async broadcast(message: string) {
        const { agents } = this.state;
        const results: Record<string, string> = {};

        for (const agent of Object.values(agents)) {
            try {
                await this.broadcastToAgent(agent.name, message);
                results[agent.name] = "Sent";
            } catch (e: any) {
                results[agent.name] = `Failed: ${e.message}`;
            }
        }
        return results;
    }

    // Handle HTTP requests via AIChatAgent base class (for /messages, etc)
    // plus custom logic.
    async onRequest(request: Request) {
        const url = new URL(request.url);

        // Allow fetching the list via GET (legacy/simple API)
        if (request.method === "GET" && url.pathname === "/api/registry") {
            const agents = Object.values(this.state.agents).sort(
                (a, b) => b.createdAt - a.createdAt
            );
            return new Response(JSON.stringify(agents), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // Handle POST to create/register agent
        if (request.method === "POST" && url.pathname === "/api/registry") {
            const body = await request.json() as { name: string };
            const agent = await this.register(body.name);
            return new Response(JSON.stringify(agent), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // Let the base AIChatAgent handle standard agent routes (like /messages, /connect)
        return super.fetch(request);
    }

    /**
     * Orchestrator Chat Loop
     */
    async onChatMessage(
        onFinish: StreamTextOnFinishCallback<any>,
        options?: { abortSignal?: AbortSignal }
    ) {
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                // Pass "this" as the agent context to tools
                const tools = validationSafeTools(orchestrationTools, this);

                const workersai = createWorkersAI({ binding: this.env.AI });

                const result = streamText({
                    system: `You are the Fleet Commander (Registry Agent).
Your job is to orchestrate the fleet of autonomous agents.

You have access to the following tools:
- spawn_agent: Create/wake up an agent with instructions.
- broadcast: Send a command to ALL agents.
- get_fleet_status: Check who is online.

Always check fleet status before broadcasting if you are unsure who is online.
`,
                    messages: await convertToModelMessages(this.messages),
                    model: workersai(modelName as any),
                    tools,
                    onFinish,
                    abortSignal: options?.abortSignal
                });

                writer.merge(result.toUIMessageStream());
            }
        });

        return createUIMessageStreamResponse({ stream });
    }
}

// Helper to bind the agent instance to the tool execution context if needed
// Actually AI SDK 'execute' signature is (args, options). Options contains { toolCallId, messages }.
// It does NOT contain { agent } by default unless we inject it or use closure.
// Wait, my orchestration.ts defined `execute: async ({...}, { agent })`. 
// The AI SDK `streamText` tools definition expects `execute(args, { toolCallId, messages, ... })`.
// So we need to wrap the tools to inject the agent.

function validationSafeTools(tools: typeof orchestrationTools, agentInstance: Registry) {
    const wrapped: any = {};
    for (const [key, toolDef] of Object.entries(tools)) {
        wrapped[key] = {
            ...toolDef,
            execute: async (args: any, context: any) => {
                // Inject agent into the second argument (context) which our tool expects
                return toolDef.execute(args, { ...context, agent: agentInstance });
            }
        };
    }
    return wrapped;
}
