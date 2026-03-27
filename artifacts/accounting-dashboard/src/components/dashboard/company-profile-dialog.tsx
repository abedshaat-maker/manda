import { useState, useEffect } from "react";
import { User, Phone, Mail, Building2, Save, Loader2 } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Director {
  name: string;
  appointedOn: string | null;
  phone: string | null;
  email: string | null;
}

interface CompanyProfileDialogProps {
  companyNumber: string | null;
  companyName: string;
  onClose: () => void;
}

export function CompanyProfileDialog({
  companyNumber,
  companyName,
  onClose,
}: CompanyProfileDialogProps) {
  const [directors, setDirectors] = useState<Director[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!companyNumber) return;
    setLoading(true);
    setDirectors([]);
    setPhones({});
    setEmails({});

    customFetch<{ directors: Director[] }>(
      `/api/company/${companyNumber}/directors`
    )
      .then((data) => {
        setDirectors(data.directors);
        const initPhones: Record<string, string> = {};
        const initEmails: Record<string, string> = {};
        for (const d of data.directors) {
          initPhones[d.name] = d.phone ?? "";
          initEmails[d.name] = d.email ?? "";
        }
        setPhones(initPhones);
        setEmails(initEmails);
      })
      .catch(() => {
        toast({
          title: "Could not load directors",
          description: "Failed to fetch director information from Companies House.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [companyNumber]);

  const handleSave = async () => {
    if (!companyNumber) return;
    setSaving(true);
    try {
      await customFetch(`/api/company/${companyNumber}/directors`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directors: directors.map((d) => ({
            name: d.name,
            phone: phones[d.name]?.trim() || null,
            email: emails[d.name]?.trim() || null,
          })),
        }),
      });
      toast({ title: "Saved", description: "Director details updated." });
      onClose();
    } catch {
      toast({
        title: "Save failed",
        description: "Could not save director details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  function formatDirectorName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <Dialog open={!!companyNumber} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] bg-card rounded-2xl overflow-hidden p-0 border-border/50 shadow-2xl">
        <div className="p-6 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Company Profile
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{companyName}</span>
              {companyNumber && (
                <span className="ml-2 font-mono text-xs bg-muted px-2 py-0.5 rounded-md">
                  {companyNumber}
                </span>
              )}
            </p>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">
              Active Directors
            </h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : directors.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
              <User className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">
                No active directors found on Companies House.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {directors.map((director) => (
                <div
                  key={director.name}
                  className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm leading-tight">
                        {formatDirectorName(director.name)}
                      </p>
                      {director.appointedOn && (
                        <p className="text-xs text-muted-foreground">
                          Appointed{" "}
                          {new Date(director.appointedOn).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      type="tel"
                      placeholder="Add phone number..."
                      value={phones[director.name] ?? ""}
                      onChange={(e) =>
                        setPhones((prev) => ({
                          ...prev,
                          [director.name]: e.target.value,
                        }))
                      }
                      className="h-9 rounded-lg bg-background border-border text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      type="email"
                      placeholder="Add email address..."
                      value={emails[director.name] ?? ""}
                      onChange={(e) =>
                        setEmails((prev) => ({
                          ...prev,
                          [director.name]: e.target.value,
                        }))
                      }
                      className="h-9 rounded-lg bg-background border-border text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">
            Close
          </Button>
          {directors.length > 0 && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
