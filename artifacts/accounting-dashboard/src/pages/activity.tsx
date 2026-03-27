import { PageShell } from "@/components/layout/page-shell";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  UserPlus,
  Trash2,
  CheckCircle2,
  Mail,
  Activity,
  RefreshCw,
  FileEdit,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityName: string | null;
  details: string | null;
  createdAt: string;
}

function useActivityLog() {
  return useQuery<ActivityLogEntry[]>({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const data = await customFetch<ActivityLogEntry[]>("/api/activity-log", { method: "GET" });
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
}

function actionIcon(action: string) {
  const a = action.toLowerCase();
  if (a.includes("added") || a.includes("created")) return { Icon: UserPlus, cls: "bg-blue-50 text-blue-600" };
  if (a.includes("deleted") || a.includes("removed")) return { Icon: Trash2, cls: "bg-red-50 text-red-600" };
  if (a.includes("completed") || a.includes("complete")) return { Icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" };
  if (a.includes("email") || a.includes("sent")) return { Icon: Mail, cls: "bg-purple-50 text-purple-600" };
  if (a.includes("updated") || a.includes("modified")) return { Icon: FileEdit, cls: "bg-amber-50 text-amber-600" };
  return { Icon: Activity, cls: "bg-muted text-muted-foreground" };
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

export default function ActivityPage() {
  const { data: entries = [], isLoading, refetch, isFetching } = useActivityLog();

  const groups = groupByDate(entries);

  return (
    <PageShell
      title="Activity Log"
      subtitle="Timestamped record of all actions in the system"
      actions={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/60 rounded-lg p-4 flex items-center gap-4">
              <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-card border border-border/60 rounded-lg shadow-sm text-center py-20">
          <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-base font-semibold text-foreground">No activity yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Actions like adding clients, marking deadlines complete, and sending emails will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ date, items }) => {
            const dateLabel = (() => {
              const d = new Date(date);
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(today.getDate() - 1);
              if (date === today.toISOString().slice(0, 10)) return "Today";
              if (date === yesterday.toISOString().slice(0, 10)) return "Yesterday";
              return format(d, "EEEE, d MMMM yyyy");
            })();

            return (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{dateLabel}</p>
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-xs text-muted-foreground">{items.length} event{items.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="bg-card border border-border/60 rounded-lg shadow-sm divide-y divide-border/40 overflow-hidden">
                  {items.map((entry) => {
                    const { Icon, cls } = actionIcon(entry.action);
                    return (
                      <div key={entry.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${cls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{entry.action}</p>
                            {entry.entityName && (
                              <span className="text-xs text-muted-foreground font-medium truncate">
                                — {entry.entityName}
                              </span>
                            )}
                          </div>
                          {entry.details && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.details}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                          {format(parseISO(entry.createdAt), "HH:mm")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <p className="text-center text-xs text-muted-foreground pb-4">
            Showing last {entries.length} events · Auto-refreshes every 30 seconds
          </p>
        </div>
      )}
    </PageShell>
  );
}
