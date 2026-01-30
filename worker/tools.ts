/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";
import type { MoltbotAgent } from "./types";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() })
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      // @ts-expect-error - executeTask dynamic call
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<MoltbotAgent>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<MoltbotAgent>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

// Imports for Moltbot control
import {
  ensureMoltbotGateway,
  findExistingMoltbotProcess
} from "./gateway/process";

/**
 * Tool to manage the Moltbot gateway lifecycle (start/stop/restart)
 * Executed manually or automatically by the AI if it detects connection issues
 */
export const manageMoltbotLifecycleDef = {
  description: "Start, stop, or restart the Moltbot gateway process",
  parameters: z.object({
    action: z
      .enum(["start", "stop", "restart"])
      .describe("The action to perform on the Moltbot gateway")
  }),
  execute: async ({ action }: { action: "start" | "stop" | "restart" }) => {
    const { agent } = getCurrentAgent<MoltbotAgent>();
    if (!agent) throw new Error("Agent context not found");

    const sandbox = agent.getSandbox();
    // @ts-expect-error - env is protected
    const env = agent.env;

    try {
      if (action === "stop" || action === "restart") {
        const process = await findExistingMoltbotProcess(sandbox);
        if (process) {
          await process.kill();
          // Wait briefly for cleanup
          await new Promise((r) => setTimeout(r, 2000));
          if (action === "stop") {
            return "Moltbot gateway stopped successfully.";
          }
        } else if (action === "stop") {
          return "Moltbot gateway was not running.";
        }
      }

      if (action === "start" || action === "restart") {
        await ensureMoltbotGateway(sandbox, env, {}, agent.name);
        return `Moltbot gateway ${action === "start" ? "started" : "restarted"} successfully.`;
      }
    } catch (error) {
      console.error(`Error managing moltbot lifecycle (${action})`, error);
      return `Failed to ${action} Moltbot gateway: ${error}`;
    }
  }
};

const manageMoltbotLifecycle = tool({
  description: manageMoltbotLifecycleDef.description,
  inputSchema: manageMoltbotLifecycleDef.parameters,
  execute: manageMoltbotLifecycleDef.execute
});

/**
 * Tool to list and approve devices
 * Allows the AI to help the user pair new devices
 */
export const manageDevicesDef = {
  description: "List connected/pending devices or approve a pairing request",
  parameters: z.object({
    action: z.enum(["list", "approve"]).describe("List devices or approve one"),
    requestId: z
      .string()
      .optional()
      .describe("The requestId to approve (required if action is 'approve')")
  }),
  execute: async ({ action, requestId }: { action: "list" | "approve"; requestId?: string }) => {
    const { agent } = getCurrentAgent<MoltbotAgent>();
    if (!agent) throw new Error("Agent context not found");

    const sandbox = agent.getSandbox();
    // @ts-expect-error - env is protected
    const env = agent.env;

    try {
      // Ensure gateway is up before running CLI commands
      await ensureMoltbotGateway(sandbox, env, {}, agent.name);

      if (action === "list") {
        const proc = await sandbox.startProcess(
          "clawdbot devices list --json --url ws://localhost:18789"
        );
        // Wait up to 10s for output
        let attempts = 0;
        while (attempts < 20) {
          if (proc.status !== "running") break;
          await new Promise((r) => setTimeout(r, 500));
          attempts++;
        }
        const logs = await proc.getLogs();
        const output = logs.stdout || "";
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return `Raw output: ${output} (stderr: ${logs.stderr})`;
      }

      if (action === "approve") {
        if (!requestId) return "Error: requestId is required to approve.";
        const proc = await sandbox.startProcess(
          `clawdbot devices approve ${requestId} --url ws://localhost:18789`
        );
        // Wait up to 10s
        let attempts = 0;
        while (attempts < 20) {
          if (proc.status !== "running") break;
          await new Promise((r) => setTimeout(r, 500));
          attempts++;
        }
        const logs = await proc.getLogs();
        return logs.stdout || logs.stderr || "Command executed (no output).";
      }
    } catch (error) {
      console.error(`Error managing devices (${action})`, error);
      return `Error: ${error}`;
    }
  }
};

const manageDevices = tool({
  description: manageDevicesDef.description,
  inputSchema: manageDevicesDef.parameters,
  execute: manageDevicesDef.execute
});

/**
 * Configure Moltbot via config file or environment variables
 * Enables autonomous setup of the agent
 */
export const configureMoltbotDef = {
  description:
    "Configure Moltbot settings (writes to config.json5) and optionally restart",
  parameters: z.object({
    config: z
      .record(z.any())
      .describe("Configuration object (will be written to config.json5)"),
    restart: z
      .boolean()
      .default(false)
      .describe("Whether to restart the Moltbot process after configuring")
  }),
  execute: async ({ config, restart }: { config: Record<string, any>; restart: boolean }) => {
    const { agent } = getCurrentAgent<MoltbotAgent>();
    if (!agent) throw new Error("Agent context not found");
    const sandbox = agent.getSandbox();
    // @ts-expect-error - env is protected
    const env = agent.env;

    try {
      // 1. Detect HOME directory to know where config lives
      const proc = await sandbox.startProcess("printenv HOME");
      await new Promise((r) => setTimeout(r, 500)); // Wait for output
      const logs = await proc.getLogs();
      const homeVal = (logs.stdout || "").trim();
      const home = homeVal || "/home/node"; // Default fallback

      // 2. Ensure directory exists
      const configDir = `${home}/.openclaw`;
      const configPath = `${configDir}/config.json5`;

      // Use standard cli
      await sandbox.startProcess(`mkdir -p ${configDir}`);

      // 3. Write config
      const configStr = JSON.stringify(config, null, 2);
      // Escape single quotes for shell
      const safeConfigStr = configStr.replace(/'/g, "'\\''");

      const writeCmd = `echo '${safeConfigStr}' > ${configPath}`;
      // Fixed: unused writeProc variable removed
      await sandbox.startProcess(writeCmd);
      await new Promise((r) => setTimeout(r, 1000));

      let msg = `Configuration written to ${configPath}.`;

      if (restart) {
        msg += " Restarting Moltbot...";
        const process = await findExistingMoltbotProcess(sandbox);
        if (process) {
          await process.kill();
          await new Promise((r) => setTimeout(r, 2000));
        }
        await ensureMoltbotGateway(sandbox, env, {}, agent.name);
        msg += " Restarted successfully.";
      }

      return msg;
    } catch (error) {
      console.error("Error configuring moltbot", error);
      return `Failed to configure Moltbot: ${error}`;
    }
  }
};

const configureMoltbot = tool({
  description: configureMoltbotDef.description,
  inputSchema: configureMoltbotDef.parameters,
  execute: configureMoltbotDef.execute
});

/**
 * Read the current Moltbot configuration from config.json5
 * Enables the agent to understand current settings before modifying them
 */
export const readMoltbotConfigDef = {
  description: "Read the current Moltbot configuration from config.json5",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<MoltbotAgent>();
    if (!agent) throw new Error("Agent context not found");
    const sandbox = agent.getSandbox();

    try {
      // 1. Detect HOME directory
      const proc = await sandbox.startProcess("printenv HOME");
      await new Promise((r) => setTimeout(r, 500));
      const logs = await proc.getLogs();
      const homeVal = (logs.stdout || "").trim();
      const home = homeVal || "/home/node";

      // 2. Read config file
      const configPath = `${home}/.openclaw/config.json5`;

      const catProc = await sandbox.startProcess(`cat ${configPath}`);
      await new Promise((r) => setTimeout(r, 500));
      const catLogs = await catProc.getLogs();

      if (
        catProc.status !== "running" &&
        (catLogs.stderr || "").includes("No such file")
      ) {
        return "No configuration file found at " + configPath;
      }

      return catLogs.stdout || "Config file is empty or could not be read.";
    } catch (error) {
      console.error("Error reading moltbot config", error);
      return `Failed to read config: ${error}`;
    }
  }
};

const readMoltbotConfig = tool({
  description: readMoltbotConfigDef.description,
  inputSchema: readMoltbotConfigDef.parameters,
  execute: readMoltbotConfigDef.execute
});

/**
 * Tool to retrieve container logs for debugging
 */
export const getContainerLogsDef = {
  description: "Get recent logs from the Moltbot gateway process for debugging",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<MoltbotAgent>();
    if (!agent) throw new Error("Agent context not found");
    const sandbox = agent.getSandbox();

    try {
      const process = await findExistingMoltbotProcess(sandbox);
      if (!process) return "No Moltbot process running.";
      const logs = await process.getLogs();
      return {
        stdout: logs.stdout?.slice(-2000) || "",
        stderr: logs.stderr?.slice(-2000) || ""
      };
    } catch (error) {
      return `Failed to get logs: ${error}`;
    }
  }
};

const getContainerLogs = tool({
  description: getContainerLogsDef.description,
  inputSchema: getContainerLogsDef.parameters,
  execute: getContainerLogsDef.execute
});

/**
 * Tool to inspect container version and config
 */
export const inspectContainerDef = {
  description: "Check the Moltbot/Container version and configuration",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<MoltbotAgent>();
    if (!agent) throw new Error("Agent context not found");
    const sandbox = agent.getSandbox();

    try {
      const proc = await sandbox.startProcess("clawdbot --version");
      await new Promise((r) => setTimeout(r, 1000));
      const logs = await proc.getLogs();
      return `Version: ${logs.stdout || logs.stderr || "Unknown"}`;
    } catch (error) {
      return `Failed to inspect container: ${error}`;
    }
  }
};

const inspectContainer = tool({
  description: inspectContainerDef.description,
  inputSchema: inspectContainerDef.parameters,
  execute: inspectContainerDef.execute
});

// Import puppeteer for visual browsing
import puppeteer from "@cloudflare/puppeteer";

/**
 * Tool to browse a webpage (Agent Eyes)
 * Can read text content or take a screenshot
 */
export const browsePageDef = {
  description: "Visit a webpage to read its content or take a screenshot",
  parameters: z.object({
    url: z.string().url().describe("The URL to visit"),
    action: z
      .enum(["read", "screenshot"])
      .default("read")
      .describe(
        "Action to perform: 'read' for text content, 'screenshot' for image"
      )
  }),
  execute: async ({ url, action }: { url: string; action: "read" | "screenshot" }) => {
    const { agent } = getCurrentAgent<MoltbotAgent>();
    if (!agent) throw new Error("Agent context not found");
    // @ts-expect-error - env is protected
    const env = agent.env;

    if (!env.BROWSER) {
      return "Browser Rendering (env.BROWSER) is not configured.";
    }

    let browser;
    try {
      browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();

      // Set a realistic viewport
      await page.setViewport({ width: 1280, height: 800 });

      await page.goto(url, { waitUntil: "domcontentloaded" });

      if (action === "read") {
        // Extract text content
        const content = await page.evaluate(() => {
          return document.body.innerText;
        });
        return (
          content.slice(0, 5000) +
          (content.length > 5000 ? "\n...[truncated]" : "")
        );
      }

      if (action === "screenshot") {
        // @ts-ignore - Agents SDK UI handling of images
        const base64 = await page.screenshot({
          encoding: "base64",
          type: "jpeg",
          quality: 80
        });
        // Return markdown image to display in chat
        return `![Screenshot of ${url}](data:image/jpeg;base64,${base64})`;
      }

      return "Invalid action";
    } catch (error) {
      console.error(`Error browsing ${url}`, error);
      return `Failed to browse ${url}: ${error}`;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
};

const browsePage = tool({
  description: browsePageDef.description,
  inputSchema: browsePageDef.parameters,
  execute: browsePageDef.execute
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  // New Moltbot Tools
  manageMoltbotLifecycle,
  manageDevices,
  configureMoltbot,
  readMoltbotConfig,
  getContainerLogs,
  inspectContainer,
  // Visual Browsing
  browsePage
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  }
};
