import { useState } from "react";
import { Mail, Copy, Check, Send, Loader2 } from "lucide-react";
import { useGetEmailPreview } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface EmailPreviewDialogProps {
  clientId: string | null;
  onClose: () => void;
}

export function EmailPreviewDialog({ clientId, onClose }: EmailPreviewDialogProps) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const { toast } = useToast();

  const { data: preview, isLoading } = useGetEmailPreview(clientId || "", {
    query: {
      enabled: !!clientId,
      onSuccess: (data: any) => {
        if (data?.clientEmail) setToEmail(data.clientEmail);
      },
    }
  });

  const handleCopy = () => {
    if (!preview) return;
    const text = `Subject: ${preview.subject}\n\n${preview.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!preview || !clientId) return;
    if (!toEmail || !toEmail.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid recipient email address.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: toEmail, subject: preview.subject, body: preview.body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send");
      toast({ title: "Email sent!", description: `Reminder sent to ${toEmail}` });
      onClose();
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!clientId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] bg-card rounded-2xl overflow-hidden p-0 border-border/50 shadow-2xl">
        <div className="p-6 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Email Reminder
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : preview ? (
            <>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</span>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="bg-background rounded-xl border-border focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</span>
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50 text-foreground font-medium text-sm">
                  {preview.subject}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message</span>
                <div className="bg-muted/50 p-4 rounded-xl border border-border/50 text-foreground text-sm whitespace-pre-wrap leading-relaxed h-48 overflow-y-auto">
                  {preview.body}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Failed to load preview.</div>
          )}
        </div>

        <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Close</Button>
          <Button
            onClick={handleCopy}
            disabled={!preview || copied}
            variant="outline"
            className="rounded-xl"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button
            onClick={handleSend}
            disabled={!preview || sending || !toEmail}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
          >
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
