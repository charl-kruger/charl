// import type { Sandbox } from "@cloudflare/sandbox";

/**
 * Environment bindings for the Agent
 * Extends the basic Env with optional configuration keys used by Moltbot
 */
export interface AgentEnv extends Env {
  // AI Gateway configuration (preferred)
  AI_GATEWAY_API_KEY?: string; // API key for the provider configured in AI Gateway
  AI_GATEWAY_BASE_URL?: string; // AI Gateway URL (e.g., https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic)

  // Legacy direct provider configuration (fallback)
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  // OPENAI_API_KEY is already in Env

  MOLTBOT_GATEWAY_TOKEN?: string; // Gateway token (mapped to CLAWDBOT_GATEWAY_TOKEN for container)

  CLAWDBOT_BIND_MODE?: string;
  DEV_MODE?: string; // Set to 'true' for local dev (skips CF Access auth + moltbot device pairing)
  DEBUG_ROUTES?: string; // Set to 'true' to enable /debug/* routes
  SANDBOX_SLEEP_AFTER?: string; // How long before sandbox sleeps: 'never' (default), or duration like '10m', '1h'

  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_DM_POLICY?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_DM_POLICY?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_APP_TOKEN?: string;

  // Cloudflare Access configuration for admin routes
  CF_ACCESS_TEAM_DOMAIN?: string; // e.g., 'myteam.cloudflareaccess.com'
  CF_ACCESS_AUD?: string; // Application Audience (AUD) tag

  // R2 credentials for bucket mounting (set via wrangler secret)
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  CF_ACCOUNT_ID?: string; // Cloudflare account ID for R2 endpoint

  // Browser Rendering binding for CDP shim
  // BROWSER is already in Env

  CDP_SECRET?: string; // Shared secret for CDP endpoint authentication
  WORKER_URL?: string; // Public URL of the worker (for CDP endpoint)

  // MCP Server Binding
  MoltbotMcp: DurableObjectNamespace;
}

export interface JWTPayload {
  aud: string[];
  email: string;
  exp: number;
  iat: number;
  nbf: number;
  iss: string;
  type: string;
  identity_nonce: string;
  sub: string;
  country: string;
  name: string; // added by Access
  // custom_attributes?: Record<string, string>;
}

export type AccessUser = {
  email: string;
  name: string;
};

// Start of Hono Variables definition
import type { Sandbox } from "@cloudflare/sandbox";
export type HonoVariables = {
  accessUser?: AccessUser;
  sandbox?: Sandbox;
};

// Common interface for Agents that control Moltbot (Chat, Mcp)
import { Agent } from "agents";
export type MoltbotAgent = Agent<AgentEnv> & {
  getSandbox: () => Sandbox;
};
