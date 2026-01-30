import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentEnv, HonoVariables } from "./types";
import { tools } from "./tools";
import { getSandbox } from "@cloudflare/sandbox";

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
    // Register all tools from our shared tools definition
    // We navigate to the registerTool method if available, or try tool with correct signature
    // The previous error suggested tool() exists but signature was mismatched.
    // The agents-sdk docs say registerTool.

    // cast server to any to avoid type complaints if registerTool is not on the strict type definition of the installed sdk
    const srv = this.server as any;

    if (srv.registerTool) {
      // manageMoltbotLifecycle
      srv.registerTool(
        "manage_moltbot_lifecycle",
        {
          description: tools.manageMoltbotLifecycle.description,
          inputSchema: tools.manageMoltbotLifecycle.parameters as any
        },
        async (args: any) => {
          return tools.manageMoltbotLifecycle.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // configureMoltbot
      srv.registerTool(
        "configure_moltbot",
        {
          description: tools.configureMoltbot.description,
          inputSchema: tools.configureMoltbot.parameters as any
        },
        async (args: any) => {
          return tools.configureMoltbot.execute!(
            args.config ? args : { config: args },
            {
              toolCallId: "mcp",
              messages: []
            }
          );
        }
      );

      // readMoltbotConfig
      srv.registerTool(
        "read_moltbot_config",
        {
          description: tools.readMoltbotConfig.description,
          inputSchema: tools.readMoltbotConfig.parameters as any
        },
        async (args: any) => {
          return tools.readMoltbotConfig.execute!(args, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // manageDevices
      srv.registerTool(
        "manage_devices",
        {
          description: tools.manageDevices.description,
          inputSchema: tools.manageDevices.parameters as any
        },
        async (args: any) => {
          return tools.manageDevices.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // getContainerLogs
      srv.registerTool(
        "get_container_logs",
        {
          description: tools.getContainerLogs.description,
          inputSchema: tools.getContainerLogs.parameters as any
        },
        async (args: any) => {
          return tools.getContainerLogs.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // inspectContainer
      srv.registerTool(
        "inspect_container",
        {
          description: tools.inspectContainer.description,
          inputSchema: tools.inspectContainer.parameters as any
        },
        async (args: any) => {
          return tools.inspectContainer.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // browsePage
      srv.registerTool(
        "browse_page",
        {
          description: tools.browsePage.description,
          inputSchema: tools.browsePage.parameters as any
        },
        async (args: any) => {
          return tools.browsePage.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );
    } else {
      // Fallback to tool() if registerTool invalid
      // manageMoltbotLifecycle
      this.server.tool(
        "manage_moltbot_lifecycle",
        tools.manageMoltbotLifecycle.description,
        tools.manageMoltbotLifecycle.parameters as any,
        async (args) => {
          return tools.manageMoltbotLifecycle.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // configureMoltbot
      this.server.tool(
        "configure_moltbot",
        tools.configureMoltbot.description,
        tools.configureMoltbot.parameters as any,
        async (args) => {
          return tools.configureMoltbot.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // readMoltbotConfig
      this.server.tool(
        "read_moltbot_config",
        tools.readMoltbotConfig.description,
        tools.readMoltbotConfig.parameters as any,
        async (args) => {
          return tools.readMoltbotConfig.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // manageDevices
      this.server.tool(
        "manage_devices",
        tools.manageDevices.description,
        tools.manageDevices.parameters as any,
        async (args) => {
          return tools.manageDevices.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // getContainerLogs
      this.server.tool(
        "get_container_logs",
        tools.getContainerLogs.description,
        tools.getContainerLogs.parameters as any,
        async (args) => {
          return tools.getContainerLogs.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // inspectContainer
      this.server.tool(
        "inspect_container",
        tools.inspectContainer.description,
        tools.inspectContainer.parameters as any,
        async (args) => {
          return tools.inspectContainer.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );

      // browsePage
      this.server.tool(
        "browse_page",
        tools.browsePage.description,
        tools.browsePage.parameters as any,
        async (args) => {
          return tools.browsePage.execute!(args as any, {
            toolCallId: "mcp",
            messages: []
          });
        }
      );
    }
  }
}
