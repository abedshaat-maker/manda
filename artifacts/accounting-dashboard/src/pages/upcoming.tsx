import { useState, useMemo } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { useListClients, useMarkClientComplete } from "@workspace/api-client-react";
import { format, parseISO, addDays, isAfter, startOfDay } from "date-fns";
import { getDaysLeft, getComputedStatus } from "@/lib/client-utils";
import { CheckCircle2, AlertTriangle, Clock, Calendar, Inbox } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const WINDOWS = [
  { label: "Next 30 days", days: 30 },
  { label: "Next 60 days", days: 60 },
  { label: "Next 90 days", days: 90 },
  { label: "All upcoming", days: 0 },
];

function urgencyChip(status: string, days: number) {
  if (status === "completed") return { label: "Completed", cls: "bg-emerald-100 text-emerald-700" };
  if (status === "overdue") return { label: `${Math.abs(days)}d overdue`, cls: "bg-red-100 text-red-700" };
  if (days === 0) return { label: "Due TODAY", cls: "bg-red-100 text-red-700" };
  if (days <= 7) return { label: `${days}d left`, cls: "bg-amber-100 text-amber-700" };
  if (days <= 14) return { label: `${days}d left`, cls: "bg-amber-50 text-amber-600" };
  return { label: `${days}d left`, cls: "bg-blue-50 text-blue-600" };
}

export default function UpcomingPage() {
  const { data: clients = [], isLoading } = useListClients();
  const { mutateAsync: complete } = useMarkClientComplete();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [daysWindow, setDaysWindow] = useState(30);
  const [completing, setCompleting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const cutoff = daysWindow > 0 ? addDays(today, daysWindow) : null;

    return clients
      .filter((c) => {
        if (c.status === "completed") return false;
        const due = parseISO(c.dueDate);
        if (cutoff && isAfter(due, cutoff)) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [clients, daysWindow]);

  const overdue = filtered.filter((c) => getComputedStatus(c) === "overdue");
  const dueSoon = filtered.filter((c) => getComputedStatus(c) === "due_soon");
  const pending = filtered.filter((c) => getComputedStatus(c) === "pending");

  const handleComplete = async (id: string, label: string) => {
    setCompleting(id);
    try {
      await complete({ id });
      await qc.invalidateQueries();
      toast({ title: "Marked as completed", description: label });
    } catch {
      toast({ title: "Failed to mark complete", variant: "destructive" });
    } finally {
      setCompleting(null);
    }
  };

  return (
    <PageShell
      title="Upcoming Deadlines"
      subtitle="Chronological view of all pending and overdue filing obligations"
    >
      {/* Window filter */}
      <div className="flex items-center gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setDaysWindow(w.days)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              daysWindow === w.days
                ? "bg-primary text-white"
                : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/60 rounded-lg p-4">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-64" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border/60 rounded-lg shadow-sm text-center py-20">
          <Inbox className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-base font-semibold text-foreground">Nothing due in this window</p>
          <p className="text-sm text-muted-foreground mt-1">All clients are on track within the selected period.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <Section icon={<AlertTriangle className="w-4 h-4 text-red-600" />} title="Overdue" titleCls="text-red-700">
              {overdue.map((c) => {
                const days = getDaysLeft(c.dueDate);
                const chip = urgencyChip(getComputedStatus(c), days);
                return (
                  <DeadlineRow
                    key={c.id}
                    client={c}
                    chip={chip}
                    completing={completing === c.id}
                    onComplete={() => handleComplete(c.id, `${c.clientName} — ${c.deadlineType}`)}
                  />
                );
              })}
            </Section>
          )}

          {dueSoon.length > 0 && (
            <Section icon={<Clock className="w-4 h-4 text-amber-500" />} title="Due within 14 days">
              {dueSoon.map((c) => {
                const days = getDaysLeft(c.dueDate);
                const chip = urgencyChip(getComputedStatus(c), days);
                return (
                  <DeadlineRow
                    key={c.id}
                    client={c}
                    chip={chip}
                    completing={completing === c.id}
                    onComplete={() => handleComplete(c.id, `${c.clientName} — ${c.deadlineType}`)}
                  />
                );
              })}
            </Section>
          )}

          {pending.length > 0 && (
            <Section icon={<Calendar className="w-4 h-4 text-blue-600" />} title="Upcoming">
              {pending.map((c) => {
                const days = getDaysLeft(c.dueDate);
                const chip = urgencyChip(getComputedStatus(c), days);
                return (
                  <DeadlineRow
                    key={c.id}
                    client={c}
                    chip={chip}
                    completing={completing === c.id}
                    onComplete={() => handleComplete(c.id, `${c.clientName} — ${c.deadlineType}`)}
                  />
                );
              })}
            </Section>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Section({
  icon, title, titleCls = "text-foreground", children,
}: {
  icon: React.ReactNode;
  title: string;
  titleCls?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className={`text-sm font-bold uppercase tracking-wide ${titleCls}`}>{title}</h2>
      </div>
      <div className="bg-card border border-border/60 rounded-lg shadow-sm divide-y divide-border/40 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function DeadlineRow({
  client: c,
  chip,
  completing,
  onComplete,
}: {
  client: any;
  chip: { label: string; cls: string };
  completing: boolean;
  onComplete: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors group">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{c.clientName}</p>
        <p className="text-xs text-muted-foreground">
          {c.deadlineType} · {c.companyName} · due {format(parseISO(c.dueDate), "dd MMM yyyy")}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${chip.cls}`}>
          {chip.label}
        </span>
        <button
          onClick={onComplete}
          disabled={completing}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 disabled:opacity-40"
          title="Mark as completed"
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
