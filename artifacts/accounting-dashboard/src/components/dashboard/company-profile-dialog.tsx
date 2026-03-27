import { useState, useEffect } from "react";
import {
  User, Phone, Mail, Building2, Save, Loader2, CalendarDays,
  Clock, FileText, CheckCircle2, StickyNote,
} from "lucide-react";
import { customFetch, useListClients, Client } from "@workspace/api-client-react";
import { useClientMutations } from "@/hooks/use-clients";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const TIMEZONES: string[] =
  typeof Intl !== "undefined" && (Intl as any).supportedValuesOf
    ? (Intl as any).supportedValuesOf("timeZone")
    : [
        "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Amsterdam",
        "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
        "Asia/Dubai", "Asia/Kolkata", "Australia/Sydney",
      ];

interface Director {
  name: string;
  appointedOn: string | null;
  phone: string | null;
  email: string | null;
}

interface DeadlineEdit {
  dueDate: string;
  notes: string;
  bufferDays: string;
  assigneeTimezone: string;
  status: string;
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
  // ── Client data ──────────────────────────────────────────────────────────
  const { data: allClients = [] } = useListClients();
  const { update } = useClientMutations();
  const { toast } = useToast();

  const companyClients: Client[] = allClients.filter(
    (c) => c.companyNumber === companyNumber
  );
  const firstClient = companyClients[0];

  // ── Details tab state ────────────────────────────────────────────────────
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (firstClient) {
      setClientName(firstClient.clientName ?? "");
      setClientEmail(firstClient.clientEmail ?? "");
    }
  }, [companyNumber, firstClient?.id]);

  const saveDetails = async () => {
    if (!companyClients.length) return;
    setSavingDetails(true);
    try {
      await Promise.all(
        companyClients.map((c) =>
          update.mutateAsync({
            id: c.id,
            data: {
              clientName: clientName.trim() || undefined,
              clientEmail: clientEmail.trim() || null,
            },
          })
        )
      );
      toast({ title: "Saved", description: "Client details updated." });
    } catch {
      toast({ title: "Save failed", description: "Could not update details.", variant: "destructive" });
    } finally {
      setSavingDetails(false);
    }
  };

  // ── Deadlines tab state ──────────────────────────────────────────────────
  const [deadlineEdits, setDeadlineEdits] = useState<Record<string, DeadlineEdit>>({});
  const [savingDeadline, setSavingDeadline] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, DeadlineEdit> = {};
    for (const c of companyClients) {
      init[c.id] = {
        dueDate: c.dueDate ? c.dueDate.split("T")[0] : "",
        notes: c.notes ?? "",
        bufferDays: c.bufferDays != null ? String(c.bufferDays) : "",
        assigneeTimezone: c.assigneeTimezone ?? "__none__",
        status: c.status,
      };
    }
    setDeadlineEdits(init);
  }, [companyNumber, companyClients.length]);

  const setDeadlineField = (id: string, field: keyof DeadlineEdit, value: string) => {
    setDeadlineEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveDeadline = async (c: Client) => {
    const edit = deadlineEdits[c.id];
    if (!edit) return;
    setSavingDeadline(c.id);
    try {
      await update.mutateAsync({
        id: c.id,
        data: {
          dueDate: edit.dueDate || undefined,
          notes: edit.notes.trim() || null,
          bufferDays: edit.bufferDays !== "" ? Number(edit.bufferDays) : null,
          assigneeTimezone: edit.assigneeTimezone === "__none__" ? null : edit.assigneeTimezone || null,
          status: edit.status as any,
        },
      });
      toast({ title: "Saved", description: `${c.deadlineType} updated.` });
    } catch {
      toast({ title: "Save failed", description: "Could not update deadline.", variant: "destructive" });
    } finally {
      setSavingDeadline(null);
    }
  };

  // ── Directors tab state ──────────────────────────────────────────────────
  const [directors, setDirectors] = useState<Director[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [dirEmails, setDirEmails] = useState<Record<string, string>>({});
  const [loadingDir, setLoadingDir] = useState(false);
  const [savingDir, setSavingDir] = useState(false);

  useEffect(() => {
    if (!companyNumber) return;
    setLoadingDir(true);
    setDirectors([]);
    setPhones({});
    setDirEmails({});

    customFetch<{ directors: Director[] }>(`/api/company/${companyNumber}/directors`)
      .then((data) => {
        setDirectors(data.directors);
        const initPhones: Record<string, string> = {};
        const initEmails: Record<string, string> = {};
        for (const d of data.directors) {
          initPhones[d.name] = d.phone ?? "";
          initEmails[d.name] = d.email ?? "";
        }
        setPhones(initPhones);
        setDirEmails(initEmails);
      })
      .catch(() =>
        toast({
          title: "Could not load directors",
          description: "Failed to fetch director information from Companies House.",
          variant: "destructive",
        })
      )
      .finally(() => setLoadingDir(false));
  }, [companyNumber]);

  const saveDirectors = async () => {
    if (!companyNumber) return;
    setSavingDir(true);
    try {
      await customFetch(`/api/company/${companyNumber}/directors`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directors: directors.map((d) => ({
            name: d.name,
            phone: phones[d.name]?.trim() || null,
            email: dirEmails[d.name]?.trim() || null,
          })),
        }),
      });
      toast({ title: "Saved", description: "Director details updated." });
    } catch {
      toast({ title: "Save failed", description: "Could not save director details.", variant: "destructive" });
    } finally {
      setSavingDir(false);
    }
  };

  function formatDirectorName(name: string) {
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const statusColour = (status: string) => {
    if (status === "overdue") return "bg-destructive/15 text-destructive";
    if (status === "completed") return "bg-emerald-500/15 text-emerald-600";
    if (status === "pending") return "bg-blue-500/15 text-blue-600";
    return "bg-orange-500/15 text-orange-600";
  };

  return (
    <Dialog open={!!companyNumber} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] bg-card rounded-2xl overflow-hidden p-0 border-border/50 shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
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

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex flex-col">
          <TabsList className="mx-6 mt-4 mb-0 grid grid-cols-3 bg-muted/50 rounded-xl">
            <TabsTrigger value="details" className="rounded-lg text-xs font-semibold">
              Client Details
            </TabsTrigger>
            <TabsTrigger value="deadlines" className="rounded-lg text-xs font-semibold">
              Deadlines ({companyClients.length})
            </TabsTrigger>
            <TabsTrigger value="directors" className="rounded-lg text-xs font-semibold">
              Directors
            </TabsTrigger>
          </TabsList>

          {/* ── Details Tab ───────────────────────────────────────────── */}
          <TabsContent value="details" className="mt-0 focus-visible:outline-none">
            <div className="p-6 space-y-4 max-h-[52vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg">
                Company name and number are imported from Companies House and cannot be changed here.
              </p>

              {/* Read-only CH fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</label>
                  <div className="h-10 px-3 flex items-center rounded-xl bg-muted/20 border border-border/40 text-sm text-muted-foreground">
                    {companyName}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Number</label>
                  <div className="h-10 px-3 flex items-center rounded-xl bg-muted/20 border border-border/40 text-sm font-mono text-muted-foreground">
                    {companyNumber}
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Contact Name
                </label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client / contact name"
                  className="h-10 rounded-xl bg-muted/40 border-border"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Contact Email
                </label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="h-10 rounded-xl bg-muted/40 border-border"
                />
              </div>
            </div>

            <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} className="rounded-xl">Close</Button>
              <Button
                onClick={saveDetails}
                disabled={savingDetails || !companyClients.length}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {savingDetails ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {savingDetails ? "Saving..." : "Save Details"}
              </Button>
            </div>
          </TabsContent>

          {/* ── Deadlines Tab ─────────────────────────────────────────── */}
          <TabsContent value="deadlines" className="mt-0 focus-visible:outline-none">
            <div className="p-6 space-y-4 max-h-[52vh] overflow-y-auto">
              {companyClients.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No deadlines found for this company.
                </div>
              ) : (
                companyClients.map((c) => {
                  const edit = deadlineEdits[c.id];
                  if (!edit) return null;
                  return (
                    <div key={c.id} className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-3">
                      {/* Deadline header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-semibold text-sm text-foreground">{c.deadlineType}</span>
                        </div>
                        <Badge className={`${statusColour(c.status)} border-0 text-xs rounded-full px-2.5 py-0.5 font-semibold shadow-none capitalize`}>
                          {c.status}
                        </Badge>
                      </div>

                      {/* Due date */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" /> Due Date
                          </label>
                          <Input
                            type="date"
                            value={edit.dueDate}
                            onChange={(e) => setDeadlineField(c.id, "dueDate", e.target.value)}
                            className="h-9 rounded-lg bg-background border-border text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
                          <Select
                            value={edit.status}
                            onValueChange={(v) => setDeadlineField(c.id, "status", v)}
                          >
                            <SelectTrigger className="h-9 rounded-lg bg-background border-border text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Buffer + Timezone */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buffer Days</label>
                          <Input
                            type="number"
                            min="0"
                            max="90"
                            placeholder="e.g. 3"
                            value={edit.bufferDays}
                            onChange={(e) => setDeadlineField(c.id, "bufferDays", e.target.value)}
                            className="h-9 rounded-lg bg-background border-border text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Timezone
                          </label>
                          <Select
                            value={edit.assigneeTimezone}
                            onValueChange={(v) => setDeadlineField(c.id, "assigneeTimezone", v)}
                          >
                            <SelectTrigger className="h-9 rounded-lg bg-background border-border text-sm">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent className="max-h-48">
                              <SelectItem value="__none__">None</SelectItem>
                              {TIMEZONES.map((tz) => (
                                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <StickyNote className="w-3 h-3" /> Notes
                        </label>
                        <Textarea
                          rows={2}
                          placeholder="Any notes about this deadline..."
                          value={edit.notes}
                          onChange={(e) => setDeadlineField(c.id, "notes", e.target.value)}
                          className="rounded-lg bg-background border-border text-sm resize-none"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => saveDeadline(c)}
                          disabled={savingDeadline === c.id}
                          className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                        >
                          {savingDeadline === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-end">
              <Button variant="ghost" onClick={onClose} className="rounded-xl">Close</Button>
            </div>
          </TabsContent>

          {/* ── Directors Tab ─────────────────────────────────────────── */}
          <TabsContent value="directors" className="mt-0 focus-visible:outline-none">
            <div className="p-6 space-y-4 max-h-[52vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Active Directors</h3>
              </div>

              {loadingDir ? (
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
                  <p className="text-sm text-muted-foreground">No active directors found on Companies House.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {directors.map((director) => (
                    <div key={director.name} className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-3">
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
                                day: "numeric", month: "short", year: "numeric",
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
                          onChange={(e) => setPhones((prev) => ({ ...prev, [director.name]: e.target.value }))}
                          className="h-9 rounded-lg bg-background border-border text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          type="email"
                          placeholder="Add email address..."
                          value={dirEmails[director.name] ?? ""}
                          onChange={(e) => setDirEmails((prev) => ({ ...prev, [director.name]: e.target.value }))}
                          className="h-9 rounded-lg bg-background border-border text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} className="rounded-xl">Close</Button>
              {directors.length > 0 && (
                <Button
                  onClick={saveDirectors}
                  disabled={savingDir}
                  className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {savingDir ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {savingDir ? "Saving..." : "Save Directors"}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
