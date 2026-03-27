import { PageShell } from "@/components/layout/page-shell";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Award, Flame, BarChart3, Link } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

interface PostmortemStats {
  avgDaysLateByType: Array<{ deadlineType: string; avgDaysLate: number; count: number }>;
  completedLateCount: number;
  topExtendedClients: Array<{ clientName: string; companyName: string; extensionCount: number }>;
}

function usePostmortemStats() {
  return useQuery<PostmortemStats>({
    queryKey: ["postmortem-stats"],
    queryFn: async () => {
      const data = await customFetch<PostmortemStats>("/api/stats/postmortem", { method: "GET" });
      return data ?? { avgDaysLateByType: [], completedLateCount: 0, topExtendedClients: [] };
    },
  });
}

function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string | number; subtitle?: string; icon: any; color: string }) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl ${color === "text-destructive" ? "bg-destructive/10" : color === "text-orange-500" ? "bg-orange-500/10" : "bg-primary/10"} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PostmortemPage() {
  const { data, isLoading } = usePostmortemStats();
  const [, navigate] = useLocation();

  return (
    <PageShell
      title={<span className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-accent" />Post-Mortem Analysis</span>}
      description="Historical analysis of completed deadlines — late completions, extensions, and patterns."
      actions={
        <button
          onClick={() => navigate("/reports")}
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          <Link className="w-3 h-3" />
          Back to Reports
        </button>
      }
    >
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              title="Completions after due date"
              value={data?.completedLateCount ?? 0}
              subtitle="Total deadlines completed late across all time"
              icon={TrendingUp}
              color="text-destructive"
            />
            <StatCard
              title="Deadline types with late completions"
              value={data?.avgDaysLateByType.length ?? 0}
              subtitle="Types where at least one filing was completed late"
              icon={BarChart3}
              color="text-orange-500"
            />
          </div>

          {/* Average days late by deadline type */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-destructive" />
                Average days late by deadline type
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data || data.avgDaysLateByType.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <Award className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  No late completions recorded yet — great work!
                </div>
              ) : (
                <div className="space-y-3">
                  {data.avgDaysLateByType.map((row) => {
                    const maxDays = Math.max(...data.avgDaysLateByType.map(r => r.avgDaysLate));
                    const pct = maxDays > 0 ? (row.avgDaysLate / maxDays) * 100 : 0;
                    return (
                      <div key={row.deadlineType} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{row.deadlineType}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-destructive font-bold">{row.avgDaysLate}d avg late</span>
                            <Badge className="bg-muted/60 text-muted-foreground border-0 rounded-full text-[10px] px-2">
                              {row.count} filing{row.count !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-destructive/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top extended clients */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Most deadline extensions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data || data.topExtendedClients.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <Flame className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  No deadline extensions recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.topExtendedClients.map((row, i) => (
                    <div key={`${row.clientName}-${i}`} className="flex items-center gap-4 bg-muted/30 rounded-xl p-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        i === 0 ? "bg-orange-500/20 text-orange-600"
                        : i === 1 ? "bg-muted text-muted-foreground"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{row.clientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{row.companyName}</p>
                      </div>
                      <Badge className="bg-orange-500/15 text-orange-600 border-0 rounded-full px-3 font-semibold flex-shrink-0">
                        <Flame className="w-3 h-3 mr-1" />
                        {row.extensionCount} extension{row.extensionCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
