# 🤖 OpenClaw: The Self-Sufficient AI Worker

![npm i agents command](./npm-agents-banner.svg)

<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/agents-starter"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"/></a>

OpenClaw is a next-generation AI agent built on **Cloudflare Agents**. It goes beyond simple chat by having the power to **configure itself**, **see the web**, and **serve external clients** via MCP.

> "The first agent that doesn't need you to hold its hand."

## 🚀 Key Capabilities

### 1. 🔌 Model Context Protocol (MCP) Server
OpenClaw isn't just a chatbot; it's an intelligent backend for your other AI tools.
- **Connect** your Claude Desktop or Cursor IDE directly to OpenClaw.
- **Expose** internal tools (browsing, weather, device control) to external LLMs.
- **Endpoint**: `/mcp`

### 2. 👁️ Visual Browsing (Agent Eyes)
Powered by generic `puppeteer` support.
- **Read**: Extracts text content from any URL for analysis.
- **See**: Takes screenshots of webpages to understand visual layout.
- **Verify**: Can visually check if deployments or changes "look right".

### 3. ⚙️ Autonomous Configuration
OpenClaw manages its own existence.
- **Read Config**: Can inspect its current `config.json5`.
- **Self-Configure**: Can write new configurations and environment settings.
- **Self-Restart**: Can restart its own process to apply changes without human intervention.
- **Lifecycle**: Start, stop, and manage the underlying gateway process.

### 4. 📱 Device Management
- **List**: See all connected IoT/Edge devices.
- **Approve**: Autonomously authorize new device pairings.

---

## Quick Start

1. **Deploy**:
   ```bash
   npm run deploy
   ```

2. **Connect via MCP** (e.g., in Claude Desktop):
   Add this to your `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "openclaw": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/client", "sse", "https://<YOUR-WORKER-URL>/mcp"]
       }
     }
   }
   ```

3. **Chat or Automate**:
   - Open the web UI to chat.
   - Or ask Claude to "Configure OpenClaw" directly!

---

## Tech Stack
- **Cloudflare Workers** & **Durable Objects**: Serverless state and compute.
- **Agents SDK**: Core AI logic and state management.
- **Puppeteer**: Serverless browser automation.
- **MCP SDK**: Universal protocol for AI tool sharing.
- **Hono**: Lightweight web framework for routing.

## Project Structure

```
├── src/
│   ├── app.tsx        # Chat UI
│   ├── server.ts      # Main Worker & HTTP Routes
│   ├── tools.ts       # Shared Tool Definitions (Used by Chat & MCP)
│   ├── utils.ts       # Utilities
│   └── styles.css     # Styling
├── worker/
│   ├── mcp.ts         # MCP Server Implementation
│   ├── gateway/       # OpenClaw Process Management
│   └── types.ts       # Type Definitions
```

## Adding New Tools

OpenClaw uses a shared tool repository (`worker/tools.ts`). Any tool added there is automatically available to:
1. The Web Chat UI
2. The MCP Server (external clients)
3. Scheduled Tasks

## License
MIT
