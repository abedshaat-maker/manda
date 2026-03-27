import { useGetStats } from "@workspace/api-client-react";
import { Users, AlertTriangle, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const cards = [
  {
    title: "Total Clients",
    key: "total" as const,
    icon: Users,
    accent: "bg-blue-600",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    title: "Overdue",
    key: "overdue" as const,
    icon: AlertTriangle,
    accent: "bg-red-600",
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
  },
  {
    title: "Due Within 14 Days",
    key: "dueSoon" as const,
    icon: Clock,
    accent: "bg-amber-500",
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
  },
  {
    title: "Upcoming",
    key: "upcoming" as const,
    icon: Calendar,
    accent: "bg-indigo-500",
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
  },
  {
    title: "Completed",
    key: "completed" as const,
    icon: CheckCircle2,
    accent: "bg-emerald-500",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
];

export function StatsCards() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg border border-border/60 shadow-sm overflow-hidden">
            <div className="h-1 bg-muted animate-pulse" />
            <div className="p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const value = stats?.[card.key] ?? 0;
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-card rounded-lg border border-border/60 shadow-sm overflow-hidden group hover:shadow-md hover:border-border transition-all duration-200"
          >
            {/* Top accent bar */}
            <div className={`h-0.5 ${card.accent} opacity-80`} />

            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest leading-none">
                  {card.title}
                </p>
                <div className={`w-7 h-7 rounded-md ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                </div>
              </div>

              <p className="stat-number text-3xl font-bold text-foreground tracking-tight leading-none">
                {value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
