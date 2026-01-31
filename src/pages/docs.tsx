import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, Cpu, Globe, Terminal, ShieldCheck, Robot } from "@phosphor-icons/react";

export function DocsPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = "/"}>
                        <ArrowLeft size={24} />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                            <BookOpen className="text-orange-500" /> Documentation
                        </h1>
                        <p className="text-neutral-500">Comprehensive guide to Charl Agents architecture and usage.</p>
                    </div>
                </div>

                <Tabs defaultValue="guide" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                        <TabsTrigger value="guide">User Guide</TabsTrigger>
                        <TabsTrigger value="architecture">Architecture</TabsTrigger>
                        <TabsTrigger value="components">Components</TabsTrigger>
                        <TabsTrigger value="api">API Reference</TabsTrigger>
                    </TabsList>

                    {/* USER GUIDE TAB */}
                    <TabsContent value="guide" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-2xl">Getting Started</CardTitle>
                                <CardDescription>How to create, configure, and use your autonomous agents.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <section className="space-y-4">
                                    <h3 className="text-xl font-semibold flex items-center gap-2">
                                        <Robot size={24} className="text-blue-500" /> 1. Creating an Agent
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400">
                                        Creating an agent spawns a new dedicated worker instance (Durable Object) that persists indefinitely.
                                    </p>
                                    <ol className="list-decimal list-inside space-y-2 ml-4 text-neutral-700 dark:text-neutral-300">
                                        <li>Navigate to the <strong>Fleet Status</strong> dashboard (Home).</li>
                                        <li>Click the <strong>New Agent</strong> button.</li>
                                        <li>Enter a unique name (ID) for your agent (e.g., <code>researcher-01</code>).</li>
                                        <li>The agent will spin up instantly. Click its card to enter the control interface.</li>
                                    </ol>
                                </section>

                                <Separator />

                                <section className="space-y-4">
                                    <h3 className="text-xl font-semibold flex items-center gap-2">
                                        <Terminal size={24} className="text-purple-500" /> 2. Configuration
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400">
                                        Agents need API keys to function. These are stored securely in the agent's encrypted storage.
                                    </p>
                                    <div className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md">
                                        <h4 className="font-semibold mb-2">Required Secrets:</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm">
                                            <li><code>OPENAI_API_KEY</code>: Required for the brain (GPT-4o).</li>
                                            <li><code>ANTHROPIC_API_KEY</code>: Optional alternative model support.</li>
                                            <li><code>MOLTBOT_GATEWAY_TOKEN</code>: If pairing with a local Moltbot instance.</li>
                                        </ul>
                                    </div>
                                    <p className="text-sm text-neutral-500">
                                        Go to the <strong>Settings</strong> tab within an agent's interface to update these keys.
                                    </p>
                                </section>

                                <Separator />

                                <section className="space-y-4">
                                    <h3 className="text-xl font-semibold flex items-center gap-2">
                                        <Globe size={24} className="text-green-500" /> 3. Capabilities & Usage
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400">
                                        Once configured, your agent can perform autonomous tasks using its toolset.
                                    </p>
                                    <Accordion type="single" collapsible className="w-full">
                                        <AccordionItem value="item-1">
                                            <AccordionTrigger>Web Browsing & Research</AccordionTrigger>
                                            <AccordionContent>
                                                The agent can browse the web using a headless browser (Browser Rendering API).
                                                Ask it to "Research the latest news on X" or "Go to example.com and extract the pricing".
                                            </AccordionContent>
                                        </AccordionItem>
                                        <AccordionItem value="item-2">
                                            <AccordionTrigger>Task Scheduling</AccordionTrigger>
                                            <AccordionContent>
                                                You can schedule tasks for the future.
                                                Example: "Check the server status every morning at 9 AM".
                                                The agent manages its own CRON triggers.
                                            </AccordionContent>
                                        </AccordionItem>
                                        <AccordionItem value="item-3">
                                            <AccordionTrigger>Moltbot Integration</AccordionTrigger>
                                            <AccordionContent>
                                                If connected to a Moltbot desktop sandbox, the agent can control a real computer environment,
                                                run terminal commands, and interact with desktop applications.
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </section>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ARCHITECTURE TAB */}
                    <TabsContent value="architecture" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>System Architecture</CardTitle>
                                <CardDescription>High-level design of the Charl Agents platform.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 flex justify-center">
                                    {/* Simple CSS diagram visualization or placeholder for Mermaid */}
                                    <div className="flex flex-col items-center gap-8 w-full max-w-3xl">

                                        {/* Client Layer */}
                                        <div className="w-full flex justify-center gap-8">
                                            <div className="border-2 border-dashed border-blue-400 p-4 rounded bg-blue-50 dark:bg-blue-950/30 text-center w-48">
                                                <div className="font-bold text-blue-700 dark:text-blue-300">Client (React)</div>
                                                <div className="text-xs text-blue-600 dark:text-blue-400">Home Page</div>
                                            </div>
                                            <div className="border-2 border-dashed border-blue-400 p-4 rounded bg-blue-50 dark:bg-blue-950/30 text-center w-48">
                                                <div className="font-bold text-blue-700 dark:text-blue-300">Client (React)</div>
                                                <div className="text-xs text-blue-600 dark:text-blue-400">Agent View</div>
                                            </div>
                                        </div>

                                        {/* Edge Layer */}
                                        <div className="h-8 border-l-2 border-dashed border-neutral-300"></div>

                                        <div className="w-full border-2 border-orange-500 rounded-xl p-6 bg-orange-50 dark:bg-orange-950/20 relative">
                                            <div className="absolute -top-3 left-6 bg-orange-500 text-white px-2 text-sm font-bold rounded">Cloudflare Worker</div>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="border border-neutral-400 bg-white dark:bg-neutral-800 p-4 rounded text-center">
                                                    <div className="font-bold">Registry DO</div>
                                                    <div className="text-xs text-neutral-500">Service Discovery</div>
                                                    <div className="text-xs text-neutral-500">Presence</div>
                                                </div>
                                                <div className="border border-neutral-400 bg-white dark:bg-neutral-800 p-4 rounded text-center relative">
                                                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1 rounded">x N</div>
                                                    <div className="font-bold">Chat Agent DO</div>
                                                    <div className="text-xs text-neutral-500">AI Logic</div>
                                                    <div className="text-xs text-neutral-500">State & Storage</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Services Layer */}
                                        <div className="h-8 border-l-2 border-dashed border-neutral-300"></div>

                                        <div className="flex gap-4">
                                            <div className="border border-neutral-300 p-2 rounded text-sm bg-gray-100 dark:bg-neutral-800">OpenAI</div>
                                            <div className="border border-neutral-300 p-2 rounded text-sm bg-gray-100 dark:bg-neutral-800">Browser Rendering</div>
                                            <div className="border border-neutral-300 p-2 rounded text-sm bg-gray-100 dark:bg-neutral-800">Moltbot (Sandbox)</div>
                                        </div>

                                    </div>
                                </div>
                                <div className="mt-6 space-y-4">
                                    <h4 className="font-semibold">Key Concepts</h4>
                                    <ul className="list-disc list-inside space-y-2 text-neutral-600 dark:text-neutral-400">
                                        <li><strong>Durable Objects</strong>: Each agent is a unique DO instance with efficient, persistent storage.</li>
                                        <li><strong>Registry Pattern</strong>: A specialized 'Registry' agent tracks the lifecycle and heartbeats of other agents.</li>
                                        <li><strong>JSRPC</strong>: Internal communication between agents happens via strictly typed JavaScript RPC calls.</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* COMPONENTS TAB */}
                    <TabsContent value="components" className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Cpu size={24} /> Registry Agent
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    The phonebook of the system.
                                    <ul className="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                                        <li><strong>File</strong>: <code>worker/registry.ts</code></li>
                                        <li><strong>Role</strong>: Maintains list of active agents and their online status.</li>
                                        <li><strong>Tech</strong>: Uses <code>Agent</code> class for automatic WebSocket state syncing with the frontend.</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Robot size={24} /> Chat Agent
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    The brain of each worker.
                                    <ul className="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                                        <li><strong>File</strong>: <code>worker/server.ts</code> (Chat class)</li>
                                        <li><strong>Role</strong>: Handles user messages, executes tools, and manages chat history.</li>
                                        <li><strong>Tech</strong>: Vercel AI SDK for streaming, OpenAI for inference.</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ShieldCheck size={24} /> Moltbot Sandbox
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    The secure execution environment.
                                    <ul className="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                                        <li><strong>File</strong>: <code>@cloudflare/sandbox</code></li>
                                        <li><strong>Role</strong>: Provides a safe VM for running untrusted code or complex tasks.</li>
                                        <li><strong>Tech</strong>: Cloudflare Workers Containers.</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* API TAB */}
                    <TabsContent value="api" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>API Endpoints</CardTitle>
                                <CardDescription>Interacting with the system programmatically.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="font-mono text-sm bg-neutral-100 dark:bg-neutral-900 p-2 rounded">
                                        <span className="text-green-600 dark:text-green-400 font-bold">GET</span> /api/registry
                                    </div>
                                    <p className="text-sm text-neutral-600 ml-4">Returns a JSON list of all registered agents.</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="font-mono text-sm bg-neutral-100 dark:bg-neutral-900 p-2 rounded">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold">POST</span> /api/registry
                                    </div>
                                    <p className="text-sm text-neutral-600 ml-4">Registers a new agent. Body: <code>{`{ "name": "my-agent" }`}</code></p>
                                </div>
                                <div className="space-y-2">
                                    <div className="font-mono text-sm bg-neutral-100 dark:bg-neutral-900 p-2 rounded">
                                        <span className="text-purple-600 dark:text-purple-400 font-bold">WS</span> /api/registry/ws
                                    </div>
                                    <p className="text-sm text-neutral-600 ml-4">WebSocket endpoint for real-time updates.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
