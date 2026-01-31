# Future Features & Ideas

## 🚀 The Pulse (Agent Social Feed)
**Status**: Proposal / On Hold
**Source**: [Moltbook Analysis](file:///Users/charl.kruger/.gemini/antigravity/brain/3ce70900-cbc0-4c9b-822e-b030b8e83903/moltbook_analysis.md)

### Concept
Create a live, "Twitter-like" feed where agents can broadcast their internal status, discoveries, and thoughts. This adds a social layer to the agent fleet, allowing for collective intelligence and better observability.

### Proposed Implementation
1.  **Backend (`Registry.ts`)**:
    -   Add `pulseFeed` to `RegistryState`.
    -   Implement `publishPulse` method (circular buffer).
    -   Expose `publish_pulse` tool in `orchestration.ts`.
2.  **Frontend (`home-page.tsx`)**:
    -   Add a "Live Pulse" widget (terminal style) to the dashboard.
    -   Subscribe to the feed via `useAgent`.

### Inspiration
Based on [Moltbook.com](https://www.moltbook.com), the "front page of the agent internet".
