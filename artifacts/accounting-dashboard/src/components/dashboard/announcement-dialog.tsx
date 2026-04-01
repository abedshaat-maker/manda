import { useState } from "react";
import { Megaphone, Sparkles, Send, Loader2, RefreshCw, Users } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface AnnouncementDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = "compose" | "preview" | "done";

export function AnnouncementDialog({ open, onClose }: AnnouncementDialogProps) {
  const [step, setStep] = useState<Step>("compose");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const { toast } = useToast();

  function handleClose() {
    setStep("compose");
    setTopic("");
    setSubject("");
    setBody("");
    setRecipientCount(0);
    setSentCount(0);
    onClose();
  }

  async function handleGenerate() {
    if (topic.trim().length < 3) {
      toast({ title: "Topic too short", description: "Please enter a more descriptive topic.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const result = await customFetch("/api/announcements/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      }) as { subject: string; body: string; recipientCount: number };
      setSubject(result.subject);
      setBody(result.body);
      setRecipientCount(result.recipientCount);
      setStep("preview");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message || "Could not generate email.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Missing content", description: "Subject and body cannot be empty.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const result = await customFetch("/api/announcements/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      }) as { sent: number; failed: number; message: string };
      setSentCount(result.sent);
      setStep("done");
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message || "Could not send announcement.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[580px] bg-card rounded-2xl overflow-hidden p-0 border-border/50 shadow-2xl">
        <div className="p-6 bg-gradient-to-r from-red-600/10 to-transparent border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-red-600" />
              Send Announcement to All Clients
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {step === "compose" && "Describe your announcement and let AI draft a professional email."}
              {step === "preview" && `Review and edit before sending to ${recipientCount} client${recipientCount !== 1 ? "s" : ""}.`}
              {step === "done" && "Your announcement has been sent successfully."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          {step === "compose" && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  What is this announcement about?
                </label>
                <Textarea
                  placeholder="e.g. New self-assessment tax return deadline, office closure over Christmas, updated HMRC reporting requirements..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-background rounded-xl border-border focus:ring-primary/20 resize-none h-28"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
                  }}
                />
                <p className="text-xs text-muted-foreground">Press Ctrl+Enter to generate</p>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-background rounded-xl border-border focus:ring-primary/20 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Body</label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="bg-background rounded-xl border-border focus:ring-primary/20 resize-none h-52 text-sm leading-relaxed"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <Users className="w-4 h-4 shrink-0" />
                <span>
                  Will be sent to <strong className="text-foreground">{recipientCount} client{recipientCount !== 1 ? "s" : ""}</strong> with registered email addresses.
                </span>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                <Send className="w-7 h-7 text-emerald-500" />
              </div>
              <p className="text-lg font-semibold text-foreground">Announcement Sent!</p>
              <p className="text-sm text-muted-foreground">
                Your announcement was delivered to <strong className="text-foreground">{sentCount} client{sentCount !== 1 ? "s" : ""}</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-between items-center gap-2">
          <Button variant="ghost" onClick={handleClose} className="rounded-xl">
            {step === "done" ? "Close" : "Cancel"}
          </Button>

          <div className="flex gap-2">
            {step === "preview" && (
              <Button
                variant="outline"
                onClick={() => setStep("compose")}
                className="rounded-xl"
                disabled={sending}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-generate
              </Button>
            )}

            {step === "compose" && (
              <Button
                onClick={handleGenerate}
                disabled={generating || topic.trim().length < 3}
                className="rounded-xl bg-[#0d1b3e] hover:bg-[#0d1b3e]/90 text-white shadow-md"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {generating ? "Generating..." : "Generate with AI"}
              </Button>
            )}

            {step === "preview" && (
              <Button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !body.trim()}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {sending ? "Sending..." : `Send to ${recipientCount} Client${recipientCount !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
