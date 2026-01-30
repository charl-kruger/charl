import { useState, useEffect } from "react";
import { useAgent } from "agents/react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Save, Check, Key } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const agent = useAgent({ agent: "chat" });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // State for secrets
    const [secrets, setSecrets] = useState<Record<string, string>>({});
    const [globalStatus, setGlobalStatus] = useState<Record<string, boolean>>({});

    // UI State
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            // Construct URL to hit the worker endpoint
            const res = await fetch(`/agents/chat/${agent.name || "default"}/settings`);
            if (res.ok) {
                const data = await res.json();
                setSecrets(data.agent || {});
                setGlobalStatus(data.global || {});
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await fetch(`/agents/chat/${agent.name || "default"}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(secrets)
            });
            onClose();
        } catch (error) {
            console.error("Failed to save settings:", error);
        } finally {
            setSaving(false);
        }
    };

    const toggleShowSecret = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const updateSecret = (key: string, value: string) => {
        setSecrets(prev => ({ ...prev, [key]: value }));
    };

    const renderSecretInput = (key: string, label: string, placeholder: string) => {
        const isSetGlobally = globalStatus[key];
        const isOverridden = !!secrets[key];
        const show = showSecrets[key];

        return (
            <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                    <Label htmlFor={key}>{label}</Label>
                    {isSetGlobally && !isOverridden && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Check size={12} className="text-green-500" /> System Default Active
                        </span>
                    )}
                    {isOverridden && (
                        <span className="text-xs text-amber-500 flex items-center gap-1">
                            Overriding System Default
                        </span>
                    )}
                </div>
                <div className="relative">
                    <Input
                        id={key}
                        type={show ? "text" : "password"}
                        placeholder={isSetGlobally && !isOverridden ? "Manged by System (Enter to override)" : placeholder}
                        value={secrets[key] || ""}
                        onChange={(e) => updateSecret(key, e.target.value)}
                        className="pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => toggleShowSecret(key)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Agent Settings</DialogTitle>
                    <DialogDescription>
                        Configure credentials and preferences for this specific agent instance.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading settings...</div>
                ) : (
                    <Tabs defaultValue="llm" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="llm">Models</TabsTrigger>
                            <TabsTrigger value="social">Social</TabsTrigger>
                            <TabsTrigger value="other">Other</TabsTrigger>
                        </TabsList>

                        <TabsContent value="llm" className="space-y-4 py-4">
                            {renderSecretInput("OPENAI_API_KEY", "OpenAI API Key", "sk-...")}
                            {renderSecretInput("ANTHROPIC_API_KEY", "Anthropic API Key", "sk-ant-...")}
                        </TabsContent>

                        <TabsContent value="social" className="space-y-4 py-4">
                            {renderSecretInput("TELEGRAM_BOT_TOKEN", "Telegram Bot Token", "123:ABC...")}
                            {renderSecretInput("DISCORD_BOT_TOKEN", "Discord Bot Token", "OTI...")}
                            {renderSecretInput("SLACK_BOT_TOKEN", "Slack Bot Token", "xoxb-...")}
                            {renderSecretInput("SLACK_APP_TOKEN", "Slack App Token", "xapp-...")}
                            {renderSecretInput("WHATSAPP_TOKEN", "WhatsApp Token", "EAAG...")}
                        </TabsContent>

                        <TabsContent value="other" className="space-y-4 py-4">
                            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                                Additional configuration options will appear here as new capabilities are added to the agent.
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
