import { useMemo } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { useListClients } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { format, addMonths, startOfMonth } from "date-fns";
import { getComputedStatus, getHealthScore, getHealthTier } from "@/lib/client-utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, PieChart as PieIcon, BarChart2, Activity,
  AlertTriangle, CheckCircle2, Clock, Building2,
} from "lucide-react";

const STATUS_COLORS = {
  Overdue: "#dc2626",
  "Due soon": "#f59e0b",
  Upcoming: "#3b82f6",
  Completed: "#10b981",
};

const HEALTH_COLORS = {
  Good: "#10b981",
  "At Risk": "#f59e0b",
  Critical: "#dc2626",
};

function ChartCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  children,
  wide = false,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`bg-card border border-border/60 rounded-xl shadow-sm p-6 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const { data: clients = [], isLoading } = useListClients();
  const activeClients = useMemo(() => clients.filter((c) => !c.isArchived), [clients]);

  const byStatus = useMemo(() => {
    const counts = { Overdue: 0, "Due soon": 0, Upcoming: 0, Completed: 0 };
    for (const c of activeClients) {
      const s = getComputedStatus(c);
      if (s === "overdue") counts["Overdue"]++;
      else if (s === "due_soon") counts["Due soon"]++;
      else if (s === "completed") counts["Completed"]++;
      else counts["Upcoming"]++;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [activeClients]);

  const byMonth = useMemo(() => {
    const now = startOfMonth(new Date());
    const months: { month: string; key: string; count: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const m = addMonths(now, i);
      months.push({ month: format(m, "MMM yy"), key: format(m, "yyyy-MM"), count: 0 });
    }
    for (const c of activeClients) {
      if (c.status === "completed") continue;
      const key = c.dueDate.slice(0, 7);
      const entry = months.find((m) => m.key === key);
      if (entry) entry.count++;
    }
    return months;
  }, [activeClients]);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of activeClients) {
      const t = c.deadlineType || "Other";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeClients]);

  const complianceByType = useMemo(() => {
    const counts: Record<string, { completed: number; total: number }> = {};
    for (const c of activeClients) {
      const t = c.deadlineType || "Other";
      if (!counts[t]) counts[t] = { completed: 0, total: 0 };
      counts[t].total++;
      if (c.status === "completed") counts[t].completed++;
    }
    return Object.entries(counts)
      .map(([name, { completed, total }]) => ({
        name: name.length > 22 ? name.slice(0, 22) + "…" : name,
        completed,
        outstanding: total - completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      }))
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 8);
  }, [activeClients]);

  const companiesAtRisk = useMemo(() => {
    const map: Record<string, { name: string; overdue: number; total: number }> = {};
    for (const c of activeClients) {
      const key = c.companyNumber;
      if (!map[key]) map[key] = { name: (c.companyName || c.clientName).slice(0, 25), overdue: 0, total: 0 };
      map[key].total++;
      if (getComputedStatus(c) === "overdue") map[key].overdue++;
    }
    return Object.values(map)
      .filter((x) => x.overdue > 0)
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 8);
  }, [activeClients]);

  const healthDist = useMemo(() => {
    const counts = { Good: 0, "At Risk": 0, Critical: 0 };
    for (const c of activeClients) {
      const { label } = getHealthTier(getHealthScore(c));
      if (label in counts) counts[label as keyof typeof counts]++;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [activeClients]);

  const totalActive = useMemo(() => new Set(activeClients.map((c) => c.companyNumber)).size, [activeClients]);
  const totalArchived = useMemo(() => new Set(clients.filter((c) => c.isArchived).map((c) => c.companyNumber)).size, [clients]);
  const completionRate = useMemo(() => {
    if (!activeClients.length) return 0;
    const done = activeClients.filter((c) => c.status === "completed").length;
    return Math.round((done / activeClients.length) * 100);
  }, [activeClients]);
  const overdueCount = useMemo(() => activeClients.filter((c) => getComputedStatus(c) === "overdue").length, [activeClients]);

  if (isLoading) {
    return (
      <PageShell title="Reports & Analytics" subtitle="Live charts from your client database">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border/60 rounded-xl shadow-sm p-6">
              <Skeleton className="h-4 w-36 mb-4" />
              <Skeleton className="h-48 w-full" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Reports & Analytics" subtitle="Visual breakdown of all client filing obligations">

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border/60 rounded-xl px-5 py-4 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Clients</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{totalActive}</p>
            {totalArchived > 0 && <p className="text-[10px] text-muted-foreground">{totalArchived} archived</p>}
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl px-5 py-4 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Completion</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{completionRate}%</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl px-5 py-4 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Overdue</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">{overdueCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl px-5 py-4 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Due Soon</p>
            <p className="text-2xl font-bold tabular-nums text-orange-500">{byStatus.find((s) => s.name === "Due soon")?.value ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Deadlines by month */}
        <ChartCard icon={BarChart2} iconBg="bg-blue-50" iconColor="text-blue-600" title="Upcoming Workload" subtitle="Deadlines per month (next 12 months)" wide>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMonth} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 22% 90%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }} cursor={{ fill: "hsl(216 18% 95%)" }} />
              <Bar dataKey="count" name="Deadlines" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Status breakdown pie */}
        <ChartCard icon={PieIcon} iconBg="bg-purple-50" iconColor="text-purple-600" title="Status Breakdown" subtitle={`All ${activeClients.length} deadline${activeClients.length !== 1 ? "s" : ""}`}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byStatus.filter((d) => d.value > 0)} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {byStatus.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11, color: "hsl(215 14% 44%)" }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Compliance by type — stacked bar */}
        <ChartCard icon={Activity} iconBg="bg-indigo-50" iconColor="text-indigo-600" title="Compliance by Deadline Type" subtitle="Completed vs outstanding per submission type" wide>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={complianceByType} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 22% 90%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} width={145} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }} cursor={{ fill: "hsl(216 18% 95%)" }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "hsl(215 14% 44%)" }}>{v}</span>} />
              <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="outstanding" name="Outstanding" stackId="a" fill="#dc2626" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Health score distribution */}
        <ChartCard icon={Activity} iconBg="bg-teal-50" iconColor="text-teal-600" title="Client Health Distribution" subtitle="Health score tiers across all active deadlines">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={healthDist.filter((d) => d.value > 0)} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {healthDist.map((entry) => (
                  <Cell key={entry.name} fill={HEALTH_COLORS[entry.name as keyof typeof HEALTH_COLORS]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11, color: "hsl(215 14% 44%)" }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* By deadline type */}
        <ChartCard icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" title="Deadline Volume by Type" subtitle={`${totalActive} active client${totalActive !== 1 ? "s" : ""}`}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 22% 90%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} width={130} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }} cursor={{ fill: "hsl(216 18% 95%)" }} />
              <Bar dataKey="count" name="Count" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Companies at risk */}
        {companiesAtRisk.length > 0 && (
          <ChartCard icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600" title="Companies at Risk" subtitle="Companies with at least one overdue submission">
            <ResponsiveContainer width="100%" height={Math.max(180, companiesAtRisk.length * 34)}>
              <BarChart data={companiesAtRisk} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 22% 90%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(215 14% 44%)" }} axisLine={false} tickLine={false} width={140} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 22% 84%)", fontSize: 12 }} cursor={{ fill: "hsl(216 18% 95%)" }} />
                <Bar dataKey="overdue" name="Overdue" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {activeClients.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-semibold text-foreground">No data yet</p>
          <p className="text-sm mt-1">Add clients from the Dashboard to generate reports.</p>
        </div>
      )}
    </PageShell>
  );
}
