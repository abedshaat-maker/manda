import { useMemo } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { useListClients } from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, addMonths, startOfMonth, parseISO } from "date-fns";
import { getComputedStatus } from "@/lib/client-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, PieChart as PieIcon, BarChart2 } from "lucide-react";

const STATUS_COLORS = {
  Overdue: "#dc2626",
  "Due soon": "#f59e0b",
  Upcoming: "#3b82f6",
  Completed: "#10b981",
};

const TYPE_COLOR = "#2563eb";

export default function ReportsPage() {
  const { data: clients = [], isLoading } = useListClients();

  const byStatus = useMemo(() => {
    const counts = { Overdue: 0, "Due soon": 0, Upcoming: 0, Completed: 0 };
    for (const c of clients) {
      const s = getComputedStatus(c);
      if (s === "overdue") counts["Overdue"]++;
      else if (s === "due_soon") counts["Due soon"]++;
      else if (s === "completed") counts["Completed"]++;
      else counts["Upcoming"]++;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [clients]);

  const byMonth = useMemo(() => {
    const now = startOfMonth(new Date());
    const months: { month: string; key: string; count: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const m = addMonths(now, i);
      months.push({ month: format(m, "MMM yy"), key: format(m, "yyyy-MM"), count: 0 });
    }
    for (const c of clients) {
      if (c.status === "completed") continue;
      const key = c.dueDate.slice(0, 7);
      const entry = months.find((m) => m.key === key);
      if (entry) entry.count++;
    }
    return months;
  }, [clients]);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clients) {
      const t = c.deadlineType || "Other";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [clients]);

  const totalClients = useMemo(() => {
    return new Set(clients.map((c) => c.companyNumber)).size;
  }, [clients]);

  if (isLoading) {
    return (
      <PageShell title="Reports & Analytics" subtitle="Live charts from your client database">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border/60 rounded-lg shadow-sm p-6">
              <Skeleton className="h-4 w-36 mb-4" />
              <Skeleton className="h-48 w-full" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Reports & Analytics"
      subtitle="Visual breakdown of all client filing obligations"
    >
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {byStatus.map((s) => (
          <div key={s.name} className="bg-card border border-border/60 rounded-lg px-5 py-4 shadow-sm">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.name}</p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: STATUS_COLORS[s.name as keyof typeof STATUS_COLORS] }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deadlines by month */}
        <div className="bg-card border border-border/60 rounded-lg shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Deadlines by Month</h3>
              <p className="text-xs text-muted-foreground">Next 12 months (pending &amp; overdue)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMonth} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 22% 90%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: "6px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }}
                cursor={{ fill: "hsl(216 18% 95%)" }}
              />
              <Bar dataKey="count" name="Deadlines" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown pie */}
        <div className="bg-card border border-border/60 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-md bg-purple-50 flex items-center justify-center">
              <PieIcon className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Status Breakdown</h3>
              <p className="text-xs text-muted-foreground">All {clients.length} deadline{clients.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={byStatus.filter((d) => d.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {byStatus.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "6px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: 11, color: "hsl(215 14% 44%)" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By deadline type */}
        <div className="bg-card border border-border/60 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">By Deadline Type</h3>
              <p className="text-xs text-muted-foreground">{totalClients} unique client{totalClients !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 22% 90%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(215 14% 44%)" }}
                axisLine={false}
                tickLine={false}
                width={130}
              />
              <Tooltip
                contentStyle={{ borderRadius: "6px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }}
                cursor={{ fill: "hsl(216 18% 95%)" }}
              />
              <Bar dataKey="count" name="Count" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {clients.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-semibold text-foreground">No data yet</p>
          <p className="text-sm mt-1">Add clients from the Dashboard to generate reports.</p>
        </div>
      )}
    </PageShell>
  );
}
