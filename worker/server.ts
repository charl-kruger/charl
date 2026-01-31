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
