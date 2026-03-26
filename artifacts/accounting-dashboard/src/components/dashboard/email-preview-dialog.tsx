import { useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { useGetEmailPreview } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface EmailPreviewDialogProps {
  clientId: string | null;
  onClose: () => void;
}

export function EmailPreviewDialog({ clientId, onClose }: EmailPreviewDialogProps) {
  const [copied, setCopied] = useState(false);
  const { data: preview, isLoading } = useGetEmailPreview(clientId || "", {
    query: { enabled: !!clientId }
  });

  const handleCopy = () => {
    if (!preview) return;
    const text = `Subject: ${preview.subject}\n\n${preview.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!clientId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-card rounded-2xl overflow-hidden p-0 border-border/50 shadow-2xl">
        <div className="p-6 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Email Reminder Preview
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
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</span>
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50 text-foreground font-medium">
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
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
