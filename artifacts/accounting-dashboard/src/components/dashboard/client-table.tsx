import { useState, useMemo } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { useLocation } from "wouter";
import {
  Search, Download, CheckCircle2, Mail, Trash2, ArrowUpDown, Undo2,
  UserSearch, ExternalLink, AlertTriangle, Clock, Flame, CalendarClock, Pencil, BookOpen,
} from "lucide-react";
import { useListClients, useExportClients, Client, customFetch } from "@workspace/api-client-react";
import { useClientMutations } from "@/hooks/use-clients";
import {
  getComputedStatus, getDaysLeft, getHealthScore, getHealthTier,
  predictSlipRisk, getBufferDate, getLocalDueDate,
} from "@/lib/client-utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmailPreviewDialog } from "./email-preview-dialog";
import { AddClientDialog } from "./add-client-dialog";
import { EditClientDialog } from "./edit-client-dialog";
import { CompanyProfileDialog } from "./company-profile-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { getExportClientsQueryKey, exportClients, getListClientsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type FilterStatus = "All" | "overdue" | "due_soon" | "pending" | "completed";

interface ClientGroup {
  key: string;
  clientName: string;
  companyNumber: string;
  companyName: string;
  deadlines: Client[];
}

const StatusBadge = ({ client }: { client: Client }) => {
  const status = getComputedStatus(client);
  switch (status) {
    case "overdue":
      return <Badge variant="destructive" className="bg-destructive/15 text-destructive border-0 rounded-full px-3 py-1 font-semibold shadow-none">Overdue</Badge>;
    case "due_soon":
      return <Badge className="bg-orange-500/15 text-orange-600 border-0 rounded-full px-3 py-1 font-semibold shadow-none">Due Soon</Badge>;
    case "completed":
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-0 rounded-full px-3 py-1 font-semibold shadow-none">Completed</Badge>;
    default:
      return <Badge className="bg-blue-500/15 text-blue-600 border-0 rounded-full px-3 py-1 font-semibold shadow-none">Pending</Badge>;
  }
};

const HealthBadge = ({ client }: { client: Client }) => {
  const score = getHealthScore(client);
  const { tier, label } = getHealthTier(score);
  const classes =
    tier === "green" ? "bg-emerald-500/15 text-emerald-600"
    : tier === "amber" ? "bg-amber-500/15 text-amber-600"
    : "bg-destructive/15 text-destructive";
  return (
    <Badge className={`${classes} border-0 rounded-full px-3 py-1 font-semibold shadow-none tabular-nums`}>
      {score} {label}
    </Badge>
  );
};

const SlipRiskIndicator = ({ client }: { client: Client }) => {
  const risk = predictSlipRisk(client);
  if (risk === "high") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex ml-1.5 text-destructive cursor-default"><AlertTriangle className="w-3.5 h-3.5" /></span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs">
          High slip risk — deadline is close or already overdue and client has not been reminded
        </TooltipContent>
      </Tooltip>
    );
  }
  if (risk === "medium") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex ml-1.5 text-amber-500 cursor-default"><Clock className="w-3.5 h-3.5" /></span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs">
          Medium slip risk — deadline is approaching
        </TooltipContent>
      </Tooltip>
    );
  }
  return null;
};

function ProposeDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const [date, setDate] = useState(client.dueDate);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const submit = async () => {
    if (!date) return;
    setLoading(true);
    try {
      await customFetch(`/api/clients/${client.id}/propose`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedDueDate: date }),
      });
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      toast({ title: "Proposal submitted", description: `New date ${format(new Date(date), "MMM dd, yyyy")} proposed.` });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to submit proposal.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Propose New Date
          </DialogTitle>
          <DialogDescription>
            {client.clientName} — {client.deadlineType}. Current due date: {format(new Date(client.dueDate), "MMM dd, yyyy")}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button onClick={submit} disabled={loading} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? "Submitting..." : "Submit Proposal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClientTable() {
  const { data: clients, isLoading } = useListClients();
  const { markComplete, remove, revertPending } = useClientMutations();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("All");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [profileCompany, setProfileCompany] = useState<{ number: string; name: string } | null>(null);
  const [proposeClient, setProposeClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [editTarget, setEditTarget] = useState<Client | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: getExportClientsQueryKey(),
        queryFn: () => exportClients(),
      });
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Deadlines");
      XLSX.writeFile(workbook, `accounting-deadlines-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const groupedClients = useMemo<ClientGroup[]>(() => {
    if (!clients) return [];
    const filtered = clients.filter((c) => {
      const matchSearch =
        c.clientName.toLowerCase().includes(search.toLowerCase()) ||
        c.companyNumber.includes(search) ||
        c.companyName.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filter === "All") return true;
      return getComputedStatus(c) === filter;
    });
    const map = new Map<string, Client[]>();
    for (const c of filtered) {
      const key = c.companyNumber || `name::${c.clientName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .map(([key, deadlines]) => ({
        key,
        clientName: deadlines[0].clientName,
        companyNumber: deadlines[0].companyNumber,
        companyName: deadlines[0].companyName,
        deadlines: [...deadlines].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
      }))
      .sort((a, b) =>
        new Date(a.deadlines[0].dueDate).getTime() - new Date(b.deadlines[0].dueDate).getTime()
      );
  }, [clients, search, filter]);

  const DeadlineActions = ({ client }: { client: Client }) => (
    <div className="flex items-center justify-end gap-1">
      {client.status !== "completed" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => markComplete.mutate({ id: client.id })} className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark Complete</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => revertPending(client.id)} className="h-8 w-8 text-orange-500 hover:bg-orange-500/10 hover:text-orange-600">
              <Undo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo — move back to Pending</TooltipContent>
        </Tooltip>
      )}
      {client.status !== "completed" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setProposeClient(client)} className="h-8 w-8 text-violet-500 hover:bg-violet-500/10 hover:text-violet-600">
              <CalendarClock className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Propose New Date</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => setPreviewId(client.id)} className="h-8 w-8 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700">
            <Mail className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send Email Reminder</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => setEditTarget(client)} className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Pencil className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit Details</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(client)} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 hide-scrollbar">
          {(["All", "overdue", "due_soon", "pending", "completed"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(f)}
              className={`rounded-full capitalize ${filter === f ? "shadow-md shadow-primary/20" : "bg-muted/50 hover:bg-muted"}`}
            >
              {f.replace("_", " ")}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl bg-card border-border/50 shadow-sm focus:ring-primary/20" />
          </div>
          <Button variant="outline" onClick={handleExport} disabled={isExporting} className="rounded-xl border-border/50 bg-card hover:bg-muted/50 shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "..." : "Export"}
          </Button>
          <AddClientDialog />
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-4 py-4 font-semibold">Health</th>
                <th className="px-6 py-4 font-semibold">Company No.</th>
                <th className="px-6 py-4 font-semibold">Deadline Type</th>
                <th className="px-6 py-4 font-semibold">
                  <div className="flex items-center gap-1">Due Date <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 font-semibold">Days Left</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (<td key={j} className="px-6 py-4"><Skeleton className="h-5 w-full" /></td>))}</tr>
                ))
              ) : groupedClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <img src={`${import.meta.env.BASE_URL}images/empty-state.png`} alt="No clients" className="w-40 h-40 opacity-50 mix-blend-multiply mb-4" />
                      <p className="text-lg font-medium text-foreground">No deadlines found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or add a new client.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                groupedClients.map((group) =>
                  group.deadlines.map((client, idx) => {
                    const daysLeft = getDaysLeft(client.dueDate);
                    const isOverdue = daysLeft < 0 && client.status !== "completed";
                    const isFirst = idx === 0;
                    const isLast = idx === group.deadlines.length - 1;
                    const hasMultiple = group.deadlines.length > 1;
                    const bufferDate = getBufferDate(client.dueDate, client.bufferDays);
                    const localDate = getLocalDueDate(client.dueDate, client.assigneeTimezone);
                    const isBurning = (client.extensionCount ?? 0) >= 3;

                    return (
                      <tr
                        key={client.id}
                        className={`hover:bg-muted/30 transition-colors group ${hasMultiple && !isLast ? "border-b-0" : ""} ${hasMultiple && !isFirst ? "bg-muted/10" : ""}`}
                      >
                        {/* Client name */}
                        <td className="px-6 py-3">
                          {isFirst ? (() => {
                            const isSE = group.companyNumber.startsWith("SE-");
                            return (
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-foreground">{group.clientName}</div>
                                  {isSE ? (
                                    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 mt-0.5">Self Employed</span>
                                  ) : group.companyName !== group.clientName ? (
                                    <div className="text-xs text-muted-foreground mt-0.5">{group.companyName}</div>
                                  ) : null}
                                  {hasMultiple && (
                                    <div className="text-xs text-primary/70 mt-1 font-medium">{group.deadlines.length} deadlines</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!isSE && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setProfileCompany({ number: group.companyNumber, name: group.companyName })} className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10">
                                          <UserSearch className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View Directors</TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" onClick={() => navigate(`/clients/${encodeURIComponent(group.companyNumber)}`)} className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View Full Profile</TooltipContent>
                                  </Tooltip>
                                  {!isSE && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => navigate(`/companies/${encodeURIComponent(group.companyNumber)}/profile`)} className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10">
                                          <BookOpen className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Company Reference Profile</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            );
                          })() : (
                            <div className="pl-3 border-l-2 border-border/50 text-xs text-muted-foreground italic">↳ same client</div>
                          )}
                        </td>

                        {/* Health score */}
                        <td className="px-4 py-3">
                          <HealthBadge client={client} />
                        </td>

                        <td className="px-6 py-3 font-mono text-muted-foreground">
                          {isFirst ? (group.companyNumber.startsWith("SE-") ? <span className="text-xs text-muted-foreground/50 not-mono">—</span> : group.companyNumber) : ""}
                        </td>

                        {/* Deadline type + burnout flame */}
                        <td className="px-6 py-3 text-foreground font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {client.deadlineType}
                            {isBurning && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-orange-500 cursor-default"><Flame className="w-3.5 h-3.5" /></span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  Extended {client.extensionCount} time{client.extensionCount !== 1 ? "s" : ""} — burnout risk
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        </td>

                        {/* Due date + slip risk + buffer date + timezone tooltip */}
                        <td className="px-6 py-3 text-muted-foreground">
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center">
                              {localDate ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default underline decoration-dotted underline-offset-2">
                                      {format(new Date(client.dueDate), "MMM dd, yyyy")}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    Local time ({client.assigneeTimezone}): {localDate}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                format(new Date(client.dueDate), "MMM dd, yyyy")
                              )}
                              <SlipRiskIndicator client={client} />
                            </span>
                            {bufferDate && client.status !== "completed" && (
                              <span className="text-[10px] text-muted-foreground/60">
                                Aim for {format(bufferDate, "MMM dd")}
                              </span>
                            )}
                            {client.proposalStatus === "pending" && client.proposedDueDate && (
                              <span className="text-[10px] text-violet-500 font-medium">
                                Proposed: {format(new Date(client.proposedDueDate), "MMM dd")}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-3">
                          {client.status === "completed" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={`font-semibold ${isOverdue ? "text-destructive" : daysLeft <= 14 ? "text-orange-500" : "text-foreground"}`}>
                              {isOverdue ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-3">
                          <StatusBadge client={client} />
                        </td>

                        <td className="px-6 py-3">
                          <DeadlineActions client={client} />
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmailPreviewDialog clientId={previewId} onClose={() => setPreviewId(null)} />
      <CompanyProfileDialog
        companyNumber={profileCompany?.number ?? null}
        companyName={profileCompany?.name ?? ""}
        onClose={() => setProfileCompany(null)}
      />
      {proposeClient && <ProposeDialog client={proposeClient} onClose={() => setProposeClient(null)} />}
      <EditClientDialog client={editTarget} onClose={() => setEditTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deadline?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.clientName}</span>
              {" — "}{deleteTarget?.deadlineType}
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (deleteTarget) {
                  remove.mutate({ id: deleteTarget.id });
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
