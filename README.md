# 🧶 Charl: The OpenClaw Orchestrator

![npm i agents command](./npm-agents-banner.svg)

<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/agents-starter"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"/></a>

**Charl** is the cloud-native orchestration platform that deploys and manages **OpenClaw** agents.

It represents a paradigm shift from "Chatbots" to **Autonomous Digital Employees**.

> "Charl manages the flock. OpenClaw does the work."

## 🌟 The Zero-Touch Revolution

Most AI agents are high-maintenance. You have to configure them, deploy them, restart them, and hand-feed them API keys.

**OpenClaw is different.** It is self-aware and self-managing.

### The "Magic Moment" Workflow
Instead of editing config files and redeploying, you simply **talk** to the agent:

> **User:** "Hey, I need you to use the new OpenAI key `sk-proj-...`."
>
> **OpenClaw:** "Understood. Updating my configuration..."
> *[OpenClaw writes to `config.json5` inside its secure sandbox]*
> *[OpenClaw triggers a self-restart]*
> 
> **OpenClaw:** "I'm back online. The new key is active. What's next?"

This isn't a scripted illusion. The agent physically manages its own process lifecycle within the Cloudflare Sandbox. It allows you to spin up a fresh agent and have it **configure itself** simply by following your instructions.

---

## 🏗️ Architecture

- **Charl (The Platform)**: A high-performance Cloudflare Worker that acts as the control plane. It handles routing, WebSocket connections, and the MCP API.
- **OpenClaw (The Worker)**: A persistent, stateful entity running in a Docker Sandbox. It has a filesystem, a CLI, and the ability to run long-running tasks.

## 🚀 Revolutionary Features

### 1. 👁️ Agent Eyes (Serverless Vision)
OpenClaw doesn't hallucinate the web. It sees it.
Powered by **Serverless Puppeteer**, Charl orchestrates browser sessions on the edge.
*   **True Verification**: When you ask "Did the deploy work?", OpenClaw visits the URL, takes a screenshot, reads the text, and confirms based on **ground truth**.
*   **Visual Debugging**: It can send you screenshots of what it sees, bridging the gap between the agent's mind and your screen.

### 2. 🔌 MCP: The Universal Connector
Charl implements the **Model Context Protocol (MCP)**, turning your OpenClaw agents into backend tools for *other* AIs.
*   **Supercharge your IDE**: Connect **Cursor** or **Claude Desktop** to Charl. Suddenly, your local IDE has access to OpenClaw's tools.
*   **Example**: Ask Cursor to "Check the logs on the IoT device." Cursor sends the request to Charl -> OpenClaw -> Device.

### 3. 📱 Autonomous Device Management
OpenClaw connects to the physical world.
*   **IoT Control**: It can discover, pair, and control local devices.
*   **Gatekeeper**: It autonomously approves/denies pairing requests based on your policies, logging every action.

---

## Quick Start

1. **Deploy Charl**:
   ```bash
   npm run deploy
   ```

2. **Connect via MCP** (e.g., in Claude Desktop):
   Add this to your `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "charl": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/client", "sse", "https://<YOUR-WORKER-URL>/mcp"]
       }
     }
   }
   ```

3. **Experience Autonomy**:
   - Open the Charl web UI.
   - Tell your new agent: *"Configure yourself to use Claude Sonnet and restart."*
   - Watch it happen.

---

## Adding New Tools

Charl defines the shared toolset in `worker/tools.ts`. Any tool added there is automatically available to:
1. The Web Chat UI
2. The MCP Server (external clients)
3. Scheduled Tasks

## License
MIT
