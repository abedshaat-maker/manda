import { useState, useMemo } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  UserPlus, Trash2, CheckCircle2, Mail, FileEdit, Activity,
  AlertTriangle, Calendar, Link2, ClipboardList, Search, Filter,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ActivityLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityName: string | null;
  details: string | null;
  createdAt: string;
}

function useAuditLog() {
  return useQuery<ActivityLogEntry[]>({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const data = await customFetch<ActivityLogEntry[]>("/api/activity-log?limit=500", { method: "GET" });
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
}

function actionMeta(action: string): { Icon: any; cls: string; color: string } {
  const a = action.toLowerCase();
  if (a.includes("added") || a.includes("created")) return { Icon: UserPlus, cls: "bg-blue-50 text-blue-600", color: "text-blue-600" };
  if (a.includes("deleted") || a.includes("removed")) return { Icon: Trash2, cls: "bg-red-50 text-red-600", color: "text-red-600" };
  if (a.includes("completed") || a.includes("complete")) return { Icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600", color: "text-emerald-600" };
  if (a.includes("email") || a.includes("sent")) return { Icon: Mail, cls: "bg-purple-50 text-purple-600", color: "text-purple-600" };
  if (a.includes("updated") || a.includes("modified") || a.includes("cascade")) return { Icon: FileEdit, cls: "bg-amber-50 text-amber-600", color: "text-amber-600" };
  if (a.includes("slip_risk") || a.includes("risk")) return { Icon: AlertTriangle, cls: "bg-red-50 text-red-500", color: "text-red-500" };
  if (a.includes("proposal") || a.includes("proposed") || a.includes("accepted") || a.includes("rejected")) return { Icon: Calendar, cls: "bg-violet-50 text-violet-600", color: "text-violet-600" };
  if (a.includes("cascade")) return { Icon: Link2, cls: "bg-orange-50 text-orange-500", color: "text-orange-500" };
  if (a.includes("notification")) return { Icon: Mail, cls: "bg-blue-50 text-blue-500", color: "text-blue-500" };
  return { Icon: Activity, cls: "bg-muted text-muted-foreground", color: "text-muted-foreground" };
}

function groupByDate(entries: ActivityLogEntry[]): { date: string; items: ActivityLogEntry[] }[] {
  const groups: { date: string; items: ActivityLogEntry[] }[] = [];
  let currentDate = "";
  for (const e of entries) {
    const d = e.createdAt.slice(0, 10);
    if (d !== currentDate) {
      currentDate = d;
      groups.push({ date: d, items: [] });
    }
    groups[groups.length - 1].items.push(e);
  }
  return groups;
}

function formatDetails(details: string | null): string | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details);
    if (parsed.changed_fields) {
      const fields = Object.entries(parsed.changed_fields)
        .map(([k, v]: any) => `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`)
        .join(", ");
      return fields;
    }
    if (parsed.shifted_by !== undefined) {
      return `Shifted by ${parsed.shifted_by} days (${parsed.from} → ${parsed.to})`;
    }
    if (parsed.proposedDueDate) {
      return `Proposed: ${parsed.proposedDueDate}`;
    }
    return details;
  } catch {
    return details;
  }
}

const ACTION_OPTIONS = [
  "All actions",
  "Client added",
  "Client deleted",
  "Deadline updated",
  "Deadline completed",
  "Email sent",
  "slip_risk_detected",
  "Date extension proposed",
  "Date extension accepted",
  "Date extension rejected",
  "Cascade due date shift",
  "Notification email sent",
];

export default function AuditPage() {
  const { data: entries = [], isLoading } = useAuditLog();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All actions");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchSearch = !search ||
        (e.entityName?.toLowerCase().includes(search.toLowerCase())) ||
        (e.details?.toLowerCase().includes(search.toLowerCase())) ||
        (e.action?.toLowerCase().includes(search.toLowerCase()));
      const matchAction = actionFilter === "All actions" || e.action === actionFilter;
      return matchSearch && matchAction;
    });
  }, [entries, search, actionFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const formatDate = (d: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (d === today) return "Today";
    if (d === yesterday) return "Yesterday";
    return format(parseISO(d), "EEEE, d MMMM yyyy");
  };

  return (
    <PageShell
      title={<span className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-accent" />Audit Trail</span>}
      description="Complete timestamped record of every change made to deadlines and clients."
    >
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by client, deadline, or detail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl bg-card border-border/50"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-64 rounded-xl bg-card border-border/50">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge className="bg-muted/60 text-muted-foreground border-0 px-3 self-start sm:self-center rounded-full">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium text-foreground">No audit events found</p>
          <p className="text-sm mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ date, items }) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{formatDate(date)}</div>
                <div className="flex-1 h-px bg-border/50" />
                <Badge className="bg-muted/60 text-muted-foreground border-0 rounded-full text-[10px] px-2">
                  {items.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {items.map((entry) => {
                  const { Icon, cls } = actionMeta(entry.action);
                  const detail = formatDetails(entry.details);
                  return (
                    <div key={entry.id} className="flex items-start gap-3 bg-card rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className={`w-7 h-7 rounded-full ${cls} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{entry.action}</span>
                          {entry.entityName && (
                            <span className="text-xs text-muted-foreground truncate">· {entry.entityName}</span>
                          )}
                        </div>
                        {detail && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{detail}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 pt-0.5">
                        {format(parseISO(entry.createdAt), "HH:mm")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
