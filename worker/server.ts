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

// Mount CDP routes (Global, not per-agent)
app.route("/cdp", cdp);
app.route("/json", cdp); // Alias /json/* to cdp

app.get("/check-open-ai-key", (c) => {
  const hasOpenAIKey = !!c.env.OPENAI_API_KEY;
  return c.json({
    success: hasOpenAIKey
  });
});

app.all("*", async (c) => {
  if (!c.env.OPENAI_API_KEY) {
    console.error(
      "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
    );
  }
  // Handle /agents/:name routes
  // The Agents SDK `routeAgentRequest` handles standard routing
  // and inspects the URL path or headers to target the right agent.

  const response = await routeAgentRequest(c.req.raw, c.env);
  if (response) {
    return response;
  }

  // SPA Fallback: Serve index.html for unknown routes
  // The 'not_found_handling: single-page-application' in wrangler.jsonc 
  // ensures env.ASSETS.fetch() returns index.html for non-existent assets.
  return c.env.ASSETS.fetch(c.req.raw);
});

// Mount MCP routes
app.use("/mcp", async (c) => {
  // We need to route to the MoltbotMcp Durable Object
  // We use a fixed ID "default" for the singleton MCP server
  const id = c.env.MoltbotMcp.idFromName("default");
  const stub = c.env.MoltbotMcp.get(id);
  return stub.fetch(c.req.raw);
});

// Mount Registry routes
app.all("/api/registry/*", async (c) => {
  // Singleton Registry
  const id = c.env.Registry.idFromName("default");
  const stub = c.env.Registry.get(id);
  // Strip /api/registry prefix if needed, or just pass through
  // The Registry DO expects /api/registry paths as is
  return stub.fetch(c.req.raw);
});

export default app;

export { Chat } from "./durable-objects/chat";

// Export the MoltbotMcp and Registry classes
export { MoltbotMcp };
export { Registry } from "./durable-objects/registry";
