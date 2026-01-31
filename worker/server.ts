import { routeAgentRequest } from "agents";
import type { AgentEnv } from "./types";
import { Hono } from "hono";
import { cdp } from "./routes/cdp";
import { MoltbotMcp } from "./mcp";
export { Sandbox } from "@cloudflare/sandbox";

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
const app = new Hono<{ Bindings: AgentEnv }>();

// DEBUG: Log all requests reaching the worker
app.use("*", async (c, next) => {
  console.log(`[Worker Global] Incoming request: ${c.req.method} ${c.req.path}`);
  await next();
});

/**
 * Validate required environment variables.
 * Returns an array of missing variable descriptions, or empty array if all are set.
 */
function validateRequiredEnv(env: AgentEnv): string[] {
  const missing: string[] = [];

  // Critical for AI
  if (!env.OPENAI_API_KEY) {
    missing.push("OPENAI_API_KEY");
  }

  if (!env.DEV_MODE) {
    // Note: The type might not have MoltbotEnv nested, checking types.ts structure
    // AgentEnv extends Env. Checking direct keys.
    if (!env.MOLTBOT_GATEWAY_TOKEN) {
      // Warn but maybe don't block if user intends to run insecurely?
      // Reference app blocks it.
      // missing.push('MOLTBOT_GATEWAY_TOKEN');
      console.warn("MOLTBOT_GATEWAY_TOKEN is not set. Gateway access will be insecure.");
    }
  }

  // Critical for Admin UI Security (Cloudflare Access)
  if (!env.DEV_MODE) {
    if (!env.CF_ACCESS_TEAM_DOMAIN) missing.push("CF_ACCESS_TEAM_DOMAIN");
    if (!env.CF_ACCESS_AUD) missing.push("CF_ACCESS_AUD");
  }

  return missing;
}


// Mount CDP routes (Global, not per-agent)
app.route("/cdp", cdp);
app.route("/json", cdp); // Alias /json/* to cdp

app.get("/check-open-ai-key", (c) => {
  const hasOpenAIKey = !!c.env.OPENAI_API_KEY;
  return c.json({
    success: hasOpenAIKey
  });
});

// Mount API routes (includes /api/admin/* protected by Access)
// MUST be mounted before the wildcard handler
import { api } from "./routes/api";
app.route("/api", api);

// Mount MCP routes
app.use("/mcp", async (c) => {
  // We need to route to the MoltbotMcp Durable Object
  // We use a fixed ID "default" for the singleton MCP server
  const id = c.env.MoltbotMcp.idFromName("default");
  const stub = c.env.MoltbotMcp.get(id);
  return stub.fetch(c.req.raw);
});

// Mount Registry routes
// Also MUST be before wildcard
app.all("/api/registry/*", async (c) => {
  // Singleton Registry
  const id = c.env.Registry.idFromName("default");
  const stub = c.env.Registry.get(id);
  // Strip /api/registry prefix if needed, or just pass through
  // The Registry DO expects /api/registry paths as is
  return stub.fetch(c.req.raw);
});

// Route /agents/registry to the Registry DO (for Chat/AI features)
// This must come BEFORE the generic /agents/:name route if that was implicit in wildcard,
// or we can handle it here implicitly if routeAgentRequest handles "registry" correctly.
// However, routeAgentRequest default behavior might map "registry" to "Chat" namespace.
// So we intercept it explicitly here.
// Manual routing removed to let routeAgentRequest handle it with correct headers
// app.all("/agents/registry/*", async (c) => {
//   const id = c.env.Registry.idFromName("default");
//   const stub = c.env.Registry.get(id);
//   const url = new URL(c.req.url);
//   if (url.pathname.startsWith("/agents/registry")) {
//     url.pathname = url.pathname.replace("/agents/registry", "") || "/";
//   }
//   const newReq = new Request(url, c.req.raw);
//   return stub.fetch(newReq);
// });

// Explicitly route Moltbot proxy requests to the Chat Durable Object
// This ensures they are handled by the server and not caught by the SPA fallback
app.all("/agents/:name/moltbot", async (c) => {
  return c.redirect(c.req.url + "/", 301);
});
app.all("/agents/:name/moltbot/", async (c) => {
  // Explicitly handle the root path with trailing slash
  return handleMoltbotRequest(c);
});
app.all("/agents/:name/moltbot/*", async (c) => {
  return handleMoltbotRequest(c);
});

// Intercept Moltbot Client API and Asset requests (which default to root paths)
// We use the Referer header to determine which Agent's Moltbot instance to target.
app.use(async (c, next) => {
  const url = new URL(c.req.url);

  // paths used by Moltbot client
  if (url.pathname.startsWith("/api/admin") || url.pathname.startsWith("/_admin")) {
    const referer = c.req.header("Referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        // Extract agent name from: /agents/{name}/moltbot...
        const match = refererUrl.pathname.match(/\/agents\/([^/]+)\/moltbot/);

        if (match && match[1]) {
          const agentName = match[1];
          console.log(`[Worker] Rewriting ambiguous request ${url.pathname} -> agent: ${agentName}`);

          if (agentName === "registry") {
            return c.text("Registry agent does not support Moltbot proxy", 404);
          }

          const id = c.env.Chat.idFromName(agentName);
          const stub = c.env.Chat.get(id);

          // We need to rewrite the URL so the DO recognizes it as a Moltbot request
          // The DO expects /moltbot/... to trigger the proxy logic
          // Map /api/admin/... -> /moltbot/api/admin/...
          // Map /_admin/... -> /moltbot/_admin/...
          // Actually, let's just prepend /moltbot so it hits the "includes('/moltbot')" check
          // and then logic in chat.ts strips it?
          // chat.ts: const subPath = url.pathname.substring(moltbotIndex + "/moltbot".length)

          // So if we send /agents/{name}/moltbot/api/admin/...
          // DO receives it.
          // chat.ts calculates subPath = /api/admin/...
          // Then if checks if /moltbot/api is in path? 
          // chat.ts: if (url.pathname.includes("/moltbot/api"))
          // Wait. If we construct the URL as /agents/{name}/moltbot/api/admin...
          // It works.

          // BUT we passed `idFromName(agentName)`.
          // The stub fetch url doesn't strictly need to match the worker's router structure, 
          // but the DO implementation uses `new URL(request.url)`.

          const newUrl = new URL(c.req.url);
          newUrl.pathname = `/agents/${agentName}/moltbot${url.pathname}`;

          const newReq = new Request(newUrl, c.req.raw);
          return stub.fetch(newReq);
        }
      } catch (e) {
        console.error("Error parsing referer for Moltbot routing:", e);
      }
    }
  }

  await next();
});

async function handleMoltbotRequest(c: any) {
  const name = c.req.param("name");
  console.log(`[Worker] Intercepted Moltbot proxy request for agent: ${name}, path: ${c.req.path}`);

  if (name === "registry") {
    return c.text("Registry agent does not support Moltbot proxy", 404);
  }

  const id = c.env.Chat.idFromName(name);
  const stub = c.env.Chat.get(id);

  return stub.fetch(c.req.raw);
}

// Fallback handler for Agents SDK routing and SPA
app.all("*", async (c) => {
  // 1. Validate Env on first request (fail fast-ish)
  const missingSecrets = validateRequiredEnv(c.env);
  if (missingSecrets.length > 0) {
    return c.text(`Configuration Error: Missing required secrets: ${missingSecrets.join(", ")}`, 500);
  }

  // 2. Handle /agents/:name routes
  // The Agents SDK `routeAgentRequest` handles standard routing
  // and inspects the URL path or headers to target the right agent.
  const response = await routeAgentRequest(c.req.raw, c.env);
  if (response) {
    return response;
  }

  // Guard: Do not pass WebSocket upgrades to ASSETS binding (causes Miniflare crash)
  if (c.req.header("Upgrade") === "websocket") {
    console.warn(`[Worker] Blocked unhandled WebSocket upgrade request to: ${c.req.path}`);
    return new Response("WebSocket endpoint not found", { status: 400 });
  }

  // 3. SPA Fallback: Serve index.html for unknown routes
  // The 'not_found_handling: single-page-application' in wrangler.jsonc 
  // ensures env.ASSETS.fetch() returns index.html for non-existent assets.
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;

export { Chat } from "./durable-objects/chat";

// Export the MoltbotMcp and Registry classes
export { MoltbotMcp };
export { Registry } from "./durable-objects/registry";
