import { useState, useEffect } from "react";
import { useAgent } from "agents/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Phosphor icons
import { Robot, Plus, ArrowRight, Broadcast, WifiHigh, WifiSlash, BookOpen } from "@phosphor-icons/react";


interface Agent {
    id: string;
    name: string;
    createdAt: number;
    lastSeen?: number;
}

export function HomePage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAgentName, setNewAgentName] = useState("");
    const [creating, setCreating] = useState(false);

    // Dialog States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [broadcasting, setBroadcasting] = useState(false);

    // Agent SDK Hook
    useAgent({
        agent: "registry",
        name: "default",
        onStateUpdate: (state: any) => {
            if (state && state.agents) {
                const list = Object.values(state.agents) as Agent[];
                setAgents(list.sort((a, b) => b.createdAt - a.createdAt));
                setLoading(false);
            }
        }
    });



    const handleCreateAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAgentName.trim()) return;

        setCreating(true);
        try {
            const res = await fetch("/api/registry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newAgentName.trim() })
            });

            if (res.ok) {
                window.location.href = `/agents/${newAgentName.trim()}`;
            } else {
                alert("Failed to create agent. Name might be taken.");
            }
        } catch (error) {
            console.error("Error creating agent", error);
        } finally {
            setCreating(false);
        }
    };

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastMessage.trim()) return;

        setBroadcasting(true);
        try {
            await fetch("/api/registry/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: broadcastMessage })
            });
            setBroadcastMessage("");
            setIsBroadcastOpen(false);
            alert("Broadcast sent to all agents");
        } catch (error) {
            console.error("Broadcast failed", error);
            alert("Failed to broadcast message");
        } finally {
            setBroadcasting(false);
        }
    };

    const isOnline = (lastSeen?: number) => {
        if (!lastSeen) return false;
        // Online if seen in last 60 seconds
        return (Date.now() - lastSeen) < 60000;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 p-8 font-sans">
            <div className="max-w-5xl mx-auto space-y-12">
                {/* Header */}
                <div className="text-center space-y-4 pt-12">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                        Charl <span className="text-orange-500">Agents</span>
                    </h1>
                    <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
                        Manage your fleet of autonomous OpenClaw workers. Real-time monitoring and command center.
                    </p>
                </div>

                {/* Action Bar */}
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
                        Fleet Status
                    </h2>
                    <div className="flex gap-2">
                        <Button variant="outline" className="gap-2" onClick={() => window.location.href = "/docs"}>
                            <BookOpen size={16} /> Docs
                        </Button>
                        <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Broadcast size={16} /> Broadcast Instruction
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>System Broadcast</DialogTitle>
                                    <DialogDescription>
                                        Send a high-priority instruction to ALL active agents immediately.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleBroadcast} className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Instruction</Label>
                                        <Textarea
                                            placeholder="e.g. Stop all running tasks immediately."
                                            value={broadcastMessage}
                                            onChange={e => setBroadcastMessage(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" variant="destructive" disabled={broadcasting || !broadcastMessage}>
                                            {broadcasting ? "Sending..." : "Broadcast"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus size={16} /> New Agent
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create New Agent</DialogTitle>
                                    <DialogDescription>
                                        Give your agent a unique name. This will be used as its ID.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreateAgent} className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Agent Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g. devops-bot, researcher"
                                            value={newAgentName}
                                            onChange={(e) => setNewAgentName(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={creating || !newAgentName.trim()}>
                                            {creating ? "Creating..." : "Create Agent"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="text-center py-12 text-neutral-500">Connecting to Registry...</div>
                ) : agents.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                        <Robot size={48} className="mx-auto text-neutral-400 mb-4" />
                        <h3 className="text-xl font-medium text-neutral-900 dark:text-white">No agents found</h3>
                        <p className="text-neutral-500 mt-2 mb-6">Start by creating your first autonomous worker.</p>
                        <Button onClick={() => setIsCreateOpen(true)}>Create Agent</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agents.map((agent) => {
                            const online = isOnline(agent.lastSeen);
                            return (
                                <Card key={agent.id} className="hover:shadow-lg transition-shadow cursor-pointer group relative overflow-hidden" onClick={() => window.location.href = `/agents/${agent.name}`}>
                                    <div className={`absolute top-0 left-0 w-1 h-full ${online ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-700"}`} />
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-neutral-500">
                                            Agent
                                        </CardTitle>
                                        {online ? (
                                            <WifiHigh size={20} className="text-green-500 animate-pulse" title="Online" />
                                        ) : (
                                            <WifiSlash size={20} className="text-neutral-400" title="Offline" />
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold mb-1">{agent.name}</div>
                                        <div className="flex justify-between items-center text-xs text-neutral-500 mt-2">
                                            <span>Created {new Date(agent.createdAt).toLocaleDateString()}</span>
                                            <span>{online ? "Active Now" : "Offline"}</span>
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <span className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Open Interface <ArrowRight size={16} />
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
