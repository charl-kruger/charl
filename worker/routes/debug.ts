import { Hono } from "hono";
import type { AgentEnv, HonoVariables } from "../types";
import { findExistingMoltbotProcess } from "../gateway";

/**
 * Debug routes for inspecting container state
 * Note: These routes should be protected by Cloudflare Access middleware
 * when mounted in the main app
 */
const debug = new Hono<{ Bindings: AgentEnv; Variables: HonoVariables }>();

// GET /version - Returns version info from inside the container
debug.get("/version", async (c) => {
  const sandbox = c.get("sandbox");
  if (!sandbox) return c.json({ error: "Sandbox not available" }, 500);

  try {
    // Get moltbot version (CLI is still named clawdbot until upstream renames)
    const versionProcess = await sandbox.startProcess("clawdbot --version");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const versionLogs = await versionProcess.getLogs();
    const moltbotVersion = (
      versionLogs.stdout ||
      versionLogs.stderr ||
      ""
    ).trim();

    // Get node version
    const nodeProcess = await sandbox.startProcess("node --version");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const nodeLogs = await nodeProcess.getLogs();
    const nodeVersion = (nodeLogs.stdout || "").trim();

    return c.json({
      moltbot_version: moltbotVersion,
      node_version: nodeVersion
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return c.json(
      {
        status: "error",
        message: `Failed to get version info: ${errorMessage}`
      },
      500
    );
  }
});

// GET /processes - List all processes with optional logs
debug.get("/processes", async (c) => {
  const sandbox = c.get("sandbox");
  if (!sandbox) return c.json({ error: "Sandbox not available" }, 500);

  try {
    const processes = await sandbox.listProcesses();
    const includeLogs = c.req.query("logs") === "true";

    const processData = await Promise.all(
      processes.map(async (p) => {
        const data: Record<string, unknown> = {
          id: p.id,
          command: p.command,
          status: p.status,
          startTime: p.startTime?.toISOString(),
          endTime: p.endTime?.toISOString(),
          exitCode: p.exitCode
        };

        if (includeLogs) {
          try {
            const logs = await p.getLogs();
            data.stdout = logs.stdout || "";
            data.stderr = logs.stderr || "";
          } catch {
            data.logs_error = "Failed to retrieve logs";
          }
        }

        return data;
      })
    );

    // Sort by status (running first, then starting, completed, failed)
    // Within each status, sort by startTime descending (newest first)
    const statusOrder: Record<string, number> = {
      running: 0,
      starting: 1,
      completed: 2,
      failed: 3
    };

    processData.sort((a, b) => {
      const statusA = statusOrder[a.status as string] ?? 99;
      const statusB = statusOrder[b.status as string] ?? 99;
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      // Within same status, sort by startTime descending
      const timeA = (a.startTime as string) || "";
      const timeB = (b.startTime as string) || "";
      return timeB.localeCompare(timeA);
    });

    return c.json({ count: processes.length, processes: processData });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: errorMessage }, 500);
  }
});

// GET /gateway-api - Probe the moltbot gateway HTTP API
debug.get("/gateway-api", async (c) => {
  const sandbox = c.get("sandbox");
  if (!sandbox) return c.json({ error: "Sandbox not available" }, 500);

  const path = c.req.query("path") || "/";
  // Import MOLTBOT_PORT from config if possible, or hardcode/env
  const MOLTBOT_PORT = 18789;

  try {
    const url = `http://localhost:${MOLTBOT_PORT}${path}`;
    const response = await sandbox.containerFetch(
      new Request(url),
      MOLTBOT_PORT
    );
    const contentType = response.headers.get("content-type") || "";

    let body: string | object;
    if (contentType.includes("application/json")) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    return c.json({
      path,
      status: response.status,
      contentType,
      body
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: errorMessage, path }, 500);
  }
});

// GET /cli - Test moltbot CLI commands (CLI is still named clawdbot)
debug.get("/cli", async (c) => {
  const sandbox = c.get("sandbox");
  if (!sandbox) return c.json({ error: "Sandbox not available" }, 500);

  const cmd = c.req.query("cmd") || "clawdbot --help";

  try {
    const proc = await sandbox.startProcess(cmd);

    // Wait longer for command to complete
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 500));
      if (proc.status !== "running") break;
      attempts++;
    }

    const logs = await proc.getLogs();
    return c.json({
      command: cmd,
      status: proc.status,
      exitCode: proc.exitCode,
      attempts,
      stdout: logs.stdout || "",
      stderr: logs.stderr || ""
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: errorMessage, command: cmd }, 500);
  }
});

// GET /logs - Returns container logs for debugging
debug.get("/logs", async (c) => {
  const sandbox = c.get("sandbox");
  if (!sandbox) return c.json({ error: "Sandbox not available" }, 500);

  try {
    const processId = c.req.query("id");
    let process = null;

    if (processId) {
      const processes = await sandbox.listProcesses();
      process = processes.find((p) => p.id === processId);
      if (!process) {
        return c.json(
          {
            status: "not_found",
            message: `Process ${processId} not found`,
            stdout: "",
            stderr: ""
          },
          404
        );
      }
    } else {
      process = await findExistingMoltbotProcess(sandbox);
      if (!process) {
        return c.json({
          status: "no_process",
          message: "No Moltbot process is currently running",
          stdout: "",
          stderr: ""
        });
      }
    }

    const logs = await process.getLogs();
    return c.json({
      status: "ok",
      process_id: process.id,
      process_status: process.status,
      stdout: logs.stdout || "",
      stderr: logs.stderr || ""
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return c.json(
      {
        status: "error",
        message: `Failed to get logs: ${errorMessage}`,
        stdout: "",
        stderr: ""
      },
      500
    );
  }
});

// GET /env - Show environment configuration (sanitized)
debug.get("/env", async (c) => {
  return c.json({
    has_anthropic_key: !!c.env.ANTHROPIC_API_KEY,
    has_openai_key: !!c.env.OPENAI_API_KEY,
    has_gateway_token: !!c.env.MOLTBOT_GATEWAY_TOKEN,
    has_r2_access_key: !!c.env.R2_ACCESS_KEY_ID,
    has_r2_secret_key: !!c.env.R2_SECRET_ACCESS_KEY,
    has_cf_account_id: !!c.env.CF_ACCOUNT_ID,
    dev_mode: c.env.DEV_MODE,
    debug_routes: c.env.DEBUG_ROUTES,
    bind_mode: c.env.CLAWDBOT_BIND_MODE,
    cf_access_team_domain: c.env.CF_ACCESS_TEAM_DOMAIN,
    has_cf_access_aud: !!c.env.CF_ACCESS_AUD
  });
});

// GET /container-config - Read the moltbot config from inside the container
debug.get("/container-config", async (c) => {
  const sandbox = c.get("sandbox");
  if (!sandbox) return c.json({ error: "Sandbox not available" }, 500);

  try {
    const proc = await sandbox.startProcess(
      "cat /root/.clawdbot/clawdbot.json"
    );

    let attempts = 0;
    while (attempts < 10) {
      await new Promise((r) => setTimeout(r, 200));
      if (proc.status !== "running") break;
      attempts++;
    }

    const logs = await proc.getLogs();
    const stdout = logs.stdout || "";
    const stderr = logs.stderr || "";

    let config = null;
    try {
      config = JSON.parse(stdout);
    } catch {
      // Not valid JSON
    }

    return c.json({
      status: proc.status,
      exitCode: proc.exitCode,
      config,
      raw: config ? undefined : stdout,
      stderr
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: errorMessage }, 500);
  }
});

export { debug };
