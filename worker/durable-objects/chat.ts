import { type Schedule } from "agents";
import type { Registry } from "./registry";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
    generateId,
    streamText,
    type StreamTextOnFinishCallback,
    stepCountIs,
    createUIMessageStream,
    convertToModelMessages,
    createUIMessageStreamResponse,
    type ToolSet
} from "ai";
// import { openai } from "@ai-sdk/openai";
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "../utils";
import { tools, executions } from "../tools";
// import { env } from "cloudflare:workers";

const modelName = "@cf/meta/llama-3-8b-instruct";
// const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

import { MOLTBOT_PORT } from "../config";
import { getSandbox } from "@cloudflare/sandbox";
import { ensureMoltbotGateway } from "../gateway";
import type { AgentEnv } from "../types";
import { Hono } from "hono";
import { api } from "../routes/api";
import { debug } from "../routes/debug";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<AgentEnv> {
    private _sandbox: ReturnType<typeof getSandbox> | undefined;

    getSandbox() {
        if (!this._sandbox) {
            // Use the Agent's name (unique ID) as the sandbox ID
            // This ensures each Chat instance gets its own Sandbox
            const sandboxId = this.name;
            // Configure options based on environment
            const sleepAfter = this.env.SANDBOX_SLEEP_AFTER?.toLowerCase() || "never";
            const options =
                sleepAfter === "never" ? { keepAlive: true } : { sleepAfter };

            this._sandbox = getSandbox(this.env.Sandbox, sandboxId, options);
        }
        return this._sandbox;
    }



    // ... existing code ...

    async sendHeartbeat() {
        // @ts-ignore - Registry binding
        if (this.env.Registry) {
            // Cast the stub directly since generic resolution can be tricky with generated types
            const id = this.env.Registry.idFromName("default");
            // Cast the stub directly to the Registry type
            const registry = this.env.Registry.get(id) as unknown as DurableObjectStub<Registry>;
            // Use RPC call
            await registry.heartbeat(this.name);
        }
    }

    async fetch(request: Request) {
        const url = new URL(request.url);

        // Send unique heartbeat for this agent, but NOT for internal system messages
        // to avoid infinite loops (Registry Broadcast -> Chat -> Heartbeat -> Registry Update -> Broadcast)
        try {
            if (url.pathname !== "/system/instruction") {
                // Fire and forget heartbeat to not block the request
                this.ctx.waitUntil(this.sendHeartbeat());
            }
        } catch (e) {
            // Ignore heartbeat errors
        }

        // Internal System Instruction (Broadcast)
        if (url.pathname === "/system/instruction" && request.method === "POST") {
            const body = await request.json() as { message: string };
            if (body.message) {
                // Filter out internal state broadcasts from the framework (noise)
                const msg = body.message;
                const isInternalState = msg.includes('"type":"cf_agent_state"') ||
                    msg.includes('"type":"cf_agent_mcp_servers"') ||
                    msg.includes('SYSTEM BROADCAST: {"state"');

                if (isInternalState) {
                    return new Response("Ignored internal broadcast", { status: 200 });
                }

                await this.saveMessages([
                    ...this.messages,
                    {
                        id: generateId(),
                        role: "user", // Appearing as user/system instruction
                        parts: [{ type: "text", text: `SYSTEM BROADCAST: ${body.message}` }],
                        metadata: { createdAt: new Date() }
                    }
                ]);
                return new Response("Instruction received", { status: 200 });
            }
        }

        // Check if the request is for Settings API
        if (url.pathname.endsWith("/settings")) {
            if (request.method === "GET") {
                const secrets = (await this.ctx.storage.get("secrets")) || {};
                // Return masked secrets
                const maskedSecrets = Object.fromEntries(
                    Object.entries(secrets).map(([key, value]) => [
                        key,
                        value ? "********" : null
                    ])
                );
                // Also include info about global secrets
                const globalKeys = [
                    "OPENAI_API_KEY",
                    "ANTHROPIC_API_KEY",
                    "TELEGRAM_BOT_TOKEN",
                    "DISCORD_BOT_TOKEN",
                    "SLACK_BOT_TOKEN",
                    "SLACK_APP_TOKEN",
                    "WHATSAPP_TOKEN"
                ];

                const globalStatus = Object.fromEntries(
                    globalKeys.map(key => [key, !!(this.env as any)[key]])
                );

                return new Response(JSON.stringify({ agent: maskedSecrets, global: globalStatus }), {
                    headers: { "Content-Type": "application/json" }
                });
            }

            if (request.method === "POST") {
                const newSecrets = await request.json();
                await this.ctx.storage.put("secrets", newSecrets);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        // Check if the request is targeting the Moltbot proxy
        // We assume traffic to /.../moltbot/... is proxied.
        if (url.pathname.includes("/moltbot")) {
            const sandbox = this.getSandbox();
            const secrets = (await this.ctx.storage.get("secrets")) || {};

            // Ensure gateway is healthy (start if needed)
            try {
                await ensureMoltbotGateway(sandbox, this.env, secrets as Record<string, string>, this.name);
            } catch (error) {
                console.error("Failed to ensure moltbot gateway:", error);
                return new Response("Moltbot Gateway Failed", { status: 503 });
            }

            // Handle API and Debug routes
            // /moltbot/api/... -> api router
            // /moltbot/debug/... -> debug router
            if (
                url.pathname.includes("/moltbot/api") ||
                url.pathname.includes("/moltbot/debug")
            ) {
                const isDebug = url.pathname.includes("/moltbot/debug");
                const targetApp = isDebug ? debug : api;
                const prefix = isDebug ? "/moltbot/debug" : "/moltbot/api";

                // Create a temporary Hono app to handle this request with the sandbox injected
                const handler = new Hono<{
                    Bindings: AgentEnv;
                    Variables: { sandbox: any };
                }>()
                    .use("*", async (c, next) => {
                        c.set("sandbox", sandbox);
                        await next();
                    })
                    .route("/", targetApp);

                const pathIndex = url.pathname.indexOf(prefix);
                const newPath =
                    url.pathname.substring(pathIndex + prefix.length) || "/";
                const newUrl = new URL(url);
                newUrl.pathname = newPath;

                const newReq = new Request(newUrl, request);

                // Mock ExecutionContext
                const executionCtx = {
                    waitUntil: this.ctx.waitUntil.bind(this.ctx),
                    passThroughOnException: () => { }
                } as any;

                return handler.fetch(newReq, this.env, executionCtx);
            }

            // Handle WebSocket Proxy
            if (request.headers.get("Upgrade") === "websocket") {
                console.log("[WS] Proxying WebSocket connection to Moltbot");

                // Get WebSocket connection to the container
                const containerResponse = await sandbox.wsConnect(request, MOLTBOT_PORT);

                // Get the container-side WebSocket
                const containerWs = containerResponse.webSocket;
                if (!containerWs) {
                    console.error("[WS] No WebSocket in container response - falling back to direct proxy");
                    return containerResponse;
                }

                // Create a WebSocket pair for the client
                const [clientWs, serverWs] = Object.values(new WebSocketPair());

                // Accept both WebSockets
                serverWs.accept();
                containerWs.accept();

                // Helper to transform error messages
                const transformErrorMessage = (message: string, host: string): string => {
                    // Fix pairing/token errors to point to the correct admin UI
                    // Note: The Admin UI is likely at /agents/{name}/moltbot/_admin/
                    // But for simple "pairing required", we might just want to guide them there.
                    const adminPath = `/agents/${this.name}/moltbot/_admin/`;

                    if (message.includes("gateway token missing") || message.includes("gateway token mismatch")) {
                        return `Invalid or missing token. Visit https://${host}${adminPath}?token={YOUR_TOKEN}`;
                    }

                    if (message.includes("pairing required")) {
                        return `Pairing required. Visit https://${host}${adminPath}`;
                    }
                    return message;
                };

                // Relay messages from client to container
                serverWs.addEventListener("message", (event) => {
                    if (containerWs.readyState === WebSocket.OPEN) {
                        containerWs.send(event.data);
                    }
                });

                // Relay messages from container to client, with error transformation
                containerWs.addEventListener("message", (event) => {
                    let data = event.data;

                    // Try to intercept and transform error messages
                    if (typeof data === "string") {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.error?.message) {
                                parsed.error.message = transformErrorMessage(parsed.error.message, url.host);
                                data = JSON.stringify(parsed);
                            }
                        } catch (e) {
                            // Not JSON or parse error, pass through original data
                        }
                    }

                    if (serverWs.readyState === WebSocket.OPEN) {
                        serverWs.send(data);
                    }
                });

                // Handle close events
                serverWs.addEventListener("close", (event) => {
                    containerWs.close(event.code, event.reason);
                });

                containerWs.addEventListener("close", (event) => {
                    // Transform the close reason if needed
                    let reason = transformErrorMessage(event.reason, url.host);
                    // Truncate to 123 bytes max for WebSocket spec
                    if (reason.length > 123) {
                        reason = reason.slice(0, 120) + "...";
                    }
                    serverWs.close(event.code, reason);
                });

                // Handle errors
                serverWs.addEventListener("error", (event) => {
                    containerWs.close(1011, "Client error");
                });

                containerWs.addEventListener("error", (event) => {
                    serverWs.close(1011, "Container error");
                });

                return new Response(null, {
                    status: 101,
                    webSocket: clientWs,
                });
            }

            // Standard HTTP Proxy with Path Rewriting & HTML Injection
            // 1. Rewrite the URL to strip the agent prefix so the container sees requests at root
            // const url = new URL(request.url); <--- REMOVED (Shadowing caused TDZ)

            // Expected path: /agents/{agentName}/moltbot/... -> /...
            // But internal DO path might differ depending on how it's called.
            // We know we are in: if (url.pathname.includes("/moltbot"))
            const moltbotIndex = url.pathname.indexOf("/moltbot");
            const subPath = url.pathname.substring(moltbotIndex + "/moltbot".length) || "/";

            const proxyUrl = new URL(url);
            proxyUrl.pathname = subPath; // Map /moltbot/foo -> /foo
            const proxyReq = new Request(proxyUrl, request);

            const response = await sandbox.containerFetch(proxyReq, MOLTBOT_PORT);

            // 2. Intercept HTML to inject configuration and fix asset paths
            // The UI expects to be at root, but is served at /agents/{name}/moltbot/
            const contentType = response.headers.get("Content-Type") || "";
            if (contentType.includes("text/html")) {
                let html = await response.text();

                // Inject Base Path Config
                const basePath = `/agents/${this.name}/moltbot`;
                const scriptInject = `<script>window.__OPENCLAW_CONTROL_UI_BASE_PATH__=${JSON.stringify(basePath)};</script>`;
                html = html.replace("<head>", `<head>${scriptInject}`);

                // Fix Absolute Asset Paths (Vite usually outputs /assets/...)
                // We change src="/assets/..." to src="assets/..." (relative) 
                // combining with a <base> tag might be safer, but let's try regex replacement first
                // as injecting <base> can break in-page anchors.
                // Actually, simplest is to prefix with the basePath.
                html = html.replace(/(src|href)="(?!https?:\/\/)/g, `$1="${basePath}/`);
                // Fix double slashes if any
                html = html.replace(`${basePath}//`, `${basePath}/`);

                return new Response(html, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            }

            return response;
        }

        return super.fetch(request);
    }

    /**
     * Handles incoming chat messages and manages the response stream
     */
    async onChatMessage(
        onFinish: StreamTextOnFinishCallback<ToolSet>,
        options?: { abortSignal?: AbortSignal }
    ) {
        // Ensure Moltbot is running when we interact?
        // Maybe we want to start it lazily or explicitly via a tool.
        // For now, let's just make the Sandbox available.

        // const mcpConnection = await this.mcp.connect(
        //   "https://path-to-mcp-server/sse"
        // );

        // Collect all tools, including MCP tools
        const allTools = {
            ...tools,
            // ...this.mcp.getAITools()
        };

        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                // Clean up incomplete tool calls to prevent API errors
                const cleanedMessages = cleanupMessages(this.messages);

                // Process any pending tool calls from previous messages
                // This handles human-in-the-loop confirmations for tools
                const processedMessages = await processToolCalls({
                    messages: cleanedMessages,
                    dataStream: writer,
                    tools: allTools,
                    executions
                });

                const workersai = createWorkersAI({ binding: this.env.AI });

                const result = streamText({
                    system: `You are a helpful assistant that can do various tasks... 
          
You can control a Moltbot instance running in a sandbox.

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.
`,

                    messages: await convertToModelMessages(processedMessages),
                    model: workersai(modelName as any),
                    tools: allTools,
                    // Type boundary: streamText expects specific tool types, but base class uses ToolSet
                    // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
                    onFinish: onFinish as unknown as StreamTextOnFinishCallback<
                        typeof allTools
                    >,
                    stopWhen: stepCountIs(10),
                    abortSignal: options?.abortSignal
                });

                writer.merge(result.toUIMessageStream());
            }
        });

        return createUIMessageStreamResponse({ stream });
    }
    async executeTask(description: string, _task: Schedule<string>) {
        await this.saveMessages([
            ...this.messages,
            {
                id: generateId(),
                role: "user",
                parts: [
                    {
                        type: "text",
                        text: `Running scheduled task: ${description}`
                    }
                ],
                metadata: {
                    createdAt: new Date()
                }
            }
        ]);
    }
}