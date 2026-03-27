import { useState, useEffect, useRef } from "react";
import {
  User, Phone, Mail, Building2, Save, Loader2, CalendarDays,
  Clock, FileText, CheckCircle2, StickyNote, UploadCloud,
  ImageIcon, Trash2, FolderOpen, X,
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TIMEZONES: string[] =
  typeof Intl !== "undefined" && (Intl as any).supportedValuesOf
    ? (Intl as any).supportedValuesOf("timeZone")
    : [
        "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Amsterdam",
        "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
        "Asia/Dubai", "Asia/Kolkata", "Australia/Sydney",
      ];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

interface CompanyFile {
  id: string;
  file_name: string;
  category: string;
  content_type: string;
  object_path: string;
  description: string | null;
  uploaded_at: string;
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
  const { data: allClients = [] } = useListClients();
  const { update } = useClientMutations();
  const { toast } = useToast();

  const companyClients: Client[] = allClients.filter(
    (c) => c.companyNumber === companyNumber
  );
  const firstClient = companyClients[0];

  // ── Details tab ──────────────────────────────────────────────────────────
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

  // ── Deadlines tab ────────────────────────────────────────────────────────
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

  // ── Directors tab ────────────────────────────────────────────────────────
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

  // ── Portal tab ───────────────────────────────────────────────────────────
  const [portalFiles, setPortalFiles] = useState<CompanyFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [photoDesc, setPhotoDesc] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const fetchPortalFiles = async () => {
    if (!companyNumber) return;
    setLoadingFiles(true);
    try {
      const data = await customFetch<{ files: CompanyFile[] }>(
        `/api/company/${companyNumber}/files`
      );
      setPortalFiles(data.files);
    } catch {
      toast({ title: "Error", description: "Could not load company files.", variant: "destructive" });
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchPortalFiles();
  }, [companyNumber]);

  const uploadFile = async (
    file: File,
    category: "photo" | "document",
    description: string,
    setUploading: (v: boolean) => void
  ) => {
    if (!companyNumber) return;
    setUploading(true);
    try {
      const urlRes = await customFetch<{ uploadURL: string; objectPath: string }>(
        "/api/storage/uploads/request-url",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        }
      );

      await fetch(urlRes.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      await customFetch(`/api/company/${companyNumber}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          category,
          contentType: file.type,
          objectPath: urlRes.objectPath,
          description: description.trim() || null,
        }),
      });

      toast({ title: "Uploaded", description: `${file.name} added to portal.` });
      if (category === "photo") setPhotoDesc("");
      else setDocDesc("");
      await fetchPortalFiles();
    } catch {
      toast({ title: "Upload failed", description: "Could not upload file. Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: string, fileName: string) => {
    if (!companyNumber) return;
    try {
      await customFetch(`/api/company/${companyNumber}/files/${fileId}`, { method: "DELETE" });
      toast({ title: "Deleted", description: `${fileName} removed.` });
      setPortalFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      toast({ title: "Delete failed", description: "Could not remove file.", variant: "destructive" });
    }
  };

  const photos = portalFiles.filter((f) => f.category === "photo");
  const documents = portalFiles.filter((f) => f.category === "document");

  // ── Helpers ──────────────────────────────────────────────────────────────
  function formatDirectorName(name: string) {
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const statusColour = (status: string) => {
    if (status === "overdue") return "bg-destructive/15 text-destructive";
    if (status === "completed") return "bg-emerald-500/15 text-emerald-600";
    if (status === "pending") return "bg-blue-500/15 text-blue-600";
    return "bg-orange-500/15 text-orange-600";
  };

  const fileExt = (name: string) => name.split(".").pop()?.toUpperCase() ?? "FILE";

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Dialog open={!!companyNumber} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[680px] bg-card rounded-2xl overflow-hidden p-0 border-border/50 shadow-2xl">
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
          <TabsList className="mx-6 mt-4 mb-0 grid grid-cols-4 bg-muted/50 rounded-xl">
            <TabsTrigger value="details" className="rounded-lg text-xs font-semibold">
              Client Details
            </TabsTrigger>
            <TabsTrigger value="deadlines" className="rounded-lg text-xs font-semibold">
              Deadlines ({companyClients.length})
            </TabsTrigger>
            <TabsTrigger value="directors" className="rounded-lg text-xs font-semibold">
              Directors
            </TabsTrigger>
            <TabsTrigger value="portal" className="rounded-lg text-xs font-semibold">
              Portal
            </TabsTrigger>
          </TabsList>

          {/* ── Details Tab ───────────────────────────────────────────── */}
          <TabsContent value="details" className="mt-0 focus-visible:outline-none">
            <div className="p-6 space-y-4 max-h-[52vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg">
                Company name and number are imported from Companies House and cannot be changed here.
              </p>

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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-semibold text-sm text-foreground">{c.deadlineType}</span>
                        </div>
                        <Badge className={`${statusColour(c.status)} border-0 text-xs rounded-full px-2.5 py-0.5 font-semibold shadow-none capitalize`}>
                          {c.status}
                        </Badge>
                      </div>

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

          {/* ── Portal Tab ─────────────────────────────────────────────── */}
          <TabsContent value="portal" className="mt-0 focus-visible:outline-none">
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">

              {/* Photos Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-foreground">Photos</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">{photos.length}</Badge>
                </div>

                {/* Upload Photo */}
                <div className="bg-muted/30 border border-dashed border-border/60 rounded-xl p-4 space-y-3">
                  <Input
                    placeholder="Optional description for photo..."
                    value={photoDesc}
                    onChange={(e) => setPhotoDesc(e.target.value)}
                    className="h-9 rounded-lg bg-background border-border text-sm"
                  />
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(file, "photo", photoDesc, setUploadingPhoto);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="w-full rounded-lg border-dashed border-primary/40 text-primary hover:bg-primary/5 text-xs"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {uploadingPhoto ? "Uploading..." : "Choose Photo (JPG / PNG / WebP)"}
                  </Button>
                </div>

                {/* Photo Grid */}
                {loadingFiles ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[1,2,3].map((i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                  </div>
                ) : photos.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/40">
                    No photos uploaded yet
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((f) => (
                      <div key={f.id} className="relative group rounded-lg overflow-hidden bg-muted/30 border border-border/40 aspect-square">
                        <img
                          src={`${BASE}/api/storage${f.object_path}`}
                          alt={f.file_name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="self-end p-1 rounded-full bg-destructive/80 hover:bg-destructive text-white">
                                <X className="w-3 h-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Photo</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove "{f.file_name}" from the portal? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => deleteFile(f.id, f.file_name)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {f.description && (
                            <p className="text-white text-xs leading-tight line-clamp-2">{f.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border/50" />

              {/* Documents Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-foreground">Compliance Documents</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">{documents.length}</Badge>
                </div>

                {/* Upload Doc */}
                <div className="bg-muted/30 border border-dashed border-border/60 rounded-xl p-4 space-y-3">
                  <Input
                    placeholder="Optional description (e.g. VAT registration certificate)..."
                    value={docDesc}
                    onChange={(e) => setDocDesc(e.target.value)}
                    className="h-9 rounded-lg bg-background border-border text-sm"
                  />
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(file, "document", docDesc, setUploadingDoc);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploadingDoc}
                    className="w-full rounded-lg border-dashed border-primary/40 text-primary hover:bg-primary/5 text-xs"
                  >
                    {uploadingDoc ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {uploadingDoc ? "Uploading..." : "Choose Document (PDF / DOCX / XLSX)"}
                  </Button>
                </div>

                {/* Document List */}
                {loadingFiles ? (
                  <div className="space-y-2">
                    {[1,2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/40">
                    No compliance documents uploaded yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 bg-muted/30 border border-border/40 rounded-xl px-4 py-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-primary leading-none">
                            {fileExt(f.file_name)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{f.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.description ? `${f.description} · ` : ""}
                            {formatDate(f.uploaded_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a
                            href={`${BASE}/api/storage${f.object_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Download"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove "{f.file_name}" from the portal? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => deleteFile(f.id, f.file_name)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-end">
              <Button variant="ghost" onClick={onClose} className="rounded-xl">Close</Button>
            </div>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
