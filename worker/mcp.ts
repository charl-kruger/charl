import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentEnv, HonoVariables } from "./types";
import {
  manageMoltbotLifecycleDef,
  manageDevicesDef,
  configureMoltbotDef,
  readMoltbotConfigDef,
  getContainerLogsDef,
  inspectContainerDef,
  browsePageDef
} from "./tools";
import { getSandbox } from "@cloudflare/sandbox";
import { z } from "zod";

type State = {
  // Minimal state
  connectionCount: number;
};

/**
 * MoltbotMcp Agent
 * Exposes Moltbot tools via the Model Context Protocol (MCP).
 * This allows external AI clients (Claude Desktop, Cursor, etc.) to control Moltbot.
 */
export class MoltbotMcp extends McpAgent<AgentEnv, State, HonoVariables> {
  // Initialize the MCP Server
  // @ts-ignore - version mismatch between sdk and agents package
  server = new McpServer({
    name: "Moltbot",
    version: "1.0.0"
  });

  // Use a stable ID for the sandbox
  get name() {
    return "mcp-server";
  }

  // Internal sandbox instance
  private _sandbox: any;

  /**
   * getSandbox implementation for MoltbotAgent interface
   * This is called by the tools in worker/tools.ts
   */
  getSandbox() {
    if (!this._sandbox) {
      // Use the Agent's name (unique ID) (or a fixed ID for the MCP singleton)
      // For MCP, we might want to map to the *same* sandbox as the Chat agent?
      // Actually, sandboxes are 1:1 with ID.
      // If we want the MCP agent to control the SAME Moltbot as the Chat agent,
      // we need to share the ID or use the same sandbox ID.
      // However, Chat agent IDs are typically unique per user chat session?
      // Or is Chat a singleton?
      // In server.ts: const chat = env.Chat.get(env.Chat.idFromName("default"));
      // So Chat is likely a singleton named "default" or similar in our single-user setup.
      // We should use the same Sandbox ID.

      const sandboxId = "default"; // Hardcode to default for the single-user/admin use case

      const sleepAfter = this.env.SANDBOX_SLEEP_AFTER?.toLowerCase() || "never";
      const options =
        sleepAfter === "never" ? { keepAlive: true } : { sleepAfter };

      this._sandbox = getSandbox(this.env.Sandbox, sandboxId, options);
    }
    return this._sandbox;
  }

  async init() {
    // Register tools using raw definitions
    // Note: McpServer from sdk should handle Zod schemas if using proper register tool method, 
    // but here we use simple tool() registration.

    // We import the definitions from tools.ts
    // We use the imported definitions from tools.ts

    // Helper to register tool
    const register = (
      name: string,
      def: { description: string; parameters: any; execute: (args: any) => Promise<any> }
    ) => {
      this.server.tool(name, def.description, def.parameters, async (args: any) => {
        return def.execute(args);
      });
    };

    register("manage_moltbot_lifecycle", manageMoltbotLifecycleDef);
    register("manage_devices", manageDevicesDef);
    register("configure_moltbot", configureMoltbotDef);
    register("read_moltbot_config", readMoltbotConfigDef);
    register("get_container_logs", getContainerLogsDef);
    register("inspect_container", inspectContainerDef);
    register("browse_page", browsePageDef);

    // Orchestration Tools (Proxy to Registry)
    this.server.tool(
      "spawn_agent",
      "Create or wake up a generic Chat Agent with specific instructions.",
      {
        name: z.string().describe("Unique name for the agent"),
        instruction: z.string().describe("Initial system instruction")
      },
      async (args) => {
        // @ts-ignore - Generic binding lookup
        const id = this.env.Registry.idFromName("default");
        // @ts-ignore
        const registry = this.env.Registry.get(id);
        const result = await registry.spawn(args.name, args.instruction);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "broadcast",
      "Send a message to ALL registered agents.",
      {
        message: z.string().describe("The message to broadcast")
      },
      async (args) => {
        // @ts-ignore
        const id = this.env.Registry.idFromName("default");
        // @ts-ignore
        const registry = this.env.Registry.get(id);
        const result = await registry.broadcast(args.message);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }
}
