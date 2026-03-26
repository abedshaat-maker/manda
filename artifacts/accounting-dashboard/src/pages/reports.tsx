import { Sidebar } from "@/components/layout/sidebar";
import { useListClients } from "@workspace/api-client-react";
import { getDaysLeft, getComputedStatus } from "@/lib/client-utils";
import { format } from "date-fns";
import { AlertTriangle, Clock, CheckCircle2, Calendar } from "lucide-react";

export default function ReportsPage() {
  const { data: clients, isLoading } = useListClients();

  const overdue = clients?.filter(c => getComputedStatus(c) === "overdue") ?? [];
  const dueSoon = clients?.filter(c => getComputedStatus(c) === "due_soon") ?? [];
  const upcoming = clients?.filter(c => getComputedStatus(c) === "pending") ?? [];
  const completed = clients?.filter(c => c.status === "completed") ?? [];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-1">Summary of all deadline activity</p>
          </div>

          {isLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-8">
              {overdue.length > 0 && (
                <Section icon={<AlertTriangle className="w-5 h-5 text-destructive" />} title="Overdue" count={overdue.length} color="destructive">
                  {overdue.map(c => <DeadlineRow key={c.id} client={c} />)}
                </Section>
              )}
              {dueSoon.length > 0 && (
                <Section icon={<Clock className="w-5 h-5 text-orange-500" />} title="Due Soon (within 14 days)" count={dueSoon.length} color="orange">
                  {dueSoon.map(c => <DeadlineRow key={c.id} client={c} />)}
                </Section>
              )}
              {upcoming.length > 0 && (
                <Section icon={<Calendar className="w-5 h-5 text-primary" />} title="Upcoming" count={upcoming.length} color="primary">
                  {upcoming.map(c => <DeadlineRow key={c.id} client={c} />)}
                </Section>
              )}
              {completed.length > 0 && (
                <Section icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} title="Completed" count={completed.length} color="emerald">
                  {completed.map(c => <DeadlineRow key={c.id} client={c} />)}
                </Section>
              )}
              {(clients?.length ?? 0) === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  <p className="text-lg font-medium text-foreground">No data yet</p>
                  <p className="text-sm mt-1">Add clients from the Dashboard to generate reports.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, count, color, children }: { icon: React.ReactNode; title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="font-semibold text-foreground text-lg">{title}</h2>
        <span className="ml-1 text-sm text-muted-foreground">({count})</span>
      </div>
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm divide-y divide-border/50">
        {children}
      </div>
    </div>
  );
}

function DeadlineRow({ client }: { client: any }) {
  const days = getDaysLeft(client.dueDate);
  const isOverdue = days < 0 && client.status !== "completed";
  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
      <div>
        <p className="font-medium text-foreground text-sm">{client.clientName}</p>
        <p className="text-xs text-muted-foreground">{client.deadlineType} · {client.companyName}</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-muted-foreground">{format(new Date(client.dueDate), "dd MMM yyyy")}</p>
        {client.status !== "completed" && (
          <p className={`text-xs font-semibold ${isOverdue ? "text-destructive" : days <= 14 ? "text-orange-500" : "text-muted-foreground"}`}>
            {isOverdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
          </p>
        )}
      </div>
    </div>
  );
}
