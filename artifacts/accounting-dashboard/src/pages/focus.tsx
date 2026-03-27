import { PageShell } from "@/components/layout/page-shell";
import { useListClients, Client } from "@workspace/api-client-react";
import { useClientMutations } from "@/hooks/use-clients";
import {
  getComputedStatus, getDaysLeft, getHealthScore, getHealthTier, predictSlipRisk,
} from "@/lib/client-utils";
import { format } from "date-fns";
import { CheckCircle2, AlertTriangle, Clock, Zap, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function HealthBadge({ client }: { client: Client }) {
  const score = getHealthScore(client);
  const { tier, label } = getHealthTier(score);
  const cls =
    tier === "green" ? "bg-emerald-500/15 text-emerald-600"
    : tier === "amber" ? "bg-amber-500/15 text-amber-600"
    : "bg-destructive/15 text-destructive";
  return (
    <Badge className={`${cls} border-0 rounded-full px-3 py-0.5 text-xs font-semibold`}>
      {score} {label}
    </Badge>
  );
}

function SlipIcon({ client }: { client: Client }) {
  const risk = predictSlipRisk(client);
  if (risk === "high") return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
      </TooltipTrigger>
      <TooltipContent className="text-xs max-w-[200px]">High slip risk — close or overdue, no reminder sent</TooltipContent>
    </Tooltip>
  );
  if (risk === "medium") return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
      </TooltipTrigger>
      <TooltipContent className="text-xs">Medium slip risk — approaching deadline</TooltipContent>
    </Tooltip>
  );
  return null;
}

export default function FocusPage() {
  const { data: clients = [], isLoading } = useListClients();
  const { markComplete } = useClientMutations();

  const focusClients = [...clients]
    .filter((c) => {
      if (c.status === "completed") return false;
      const daysLeft = getDaysLeft(c.dueDate);
      return c.status === "overdue" || daysLeft <= 7;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <PageShell
      title={
        <span className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-accent" />
          Focus Mode
        </span>
      }
      description="Only what needs your attention right now — overdue and due within 7 days."
    >
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border/50">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : focusClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-xl font-semibold text-foreground">All clear!</p>
          <p className="text-sm mt-1">No deadlines overdue or due in the next 7 days.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-destructive/15 text-destructive border-0 rounded-full px-3 py-1 font-semibold">
              {focusClients.length} deadline{focusClients.length !== 1 ? "s" : ""} need attention
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {focusClients.map((client) => {
              const status = getComputedStatus(client);
              const daysLeft = getDaysLeft(client.dueDate);
              const isOverdue = status === "overdue";

              return (
                <Card
                  key={client.id}
                  className={`rounded-2xl border shadow-sm transition-all hover:shadow-md ${
                    isOverdue ? "border-destructive/30 bg-destructive/5" : "border-orange-500/30 bg-orange-500/5"
                  }`}
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-base leading-tight truncate">
                          {client.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{client.companyName}</p>
                      </div>
                      <HealthBadge client={client} />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">{client.deadlineType}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold ${isOverdue ? "text-destructive" : "text-orange-600"}`}>
                          {isOverdue
                            ? `${Math.abs(daysLeft)}d overdue`
                            : daysLeft === 0 ? "Due TODAY" : `${daysLeft}d left`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Due {format(new Date(client.dueDate), "MMM dd, yyyy")}
                        </span>
                        <SlipIcon client={client} />
                      </div>
                    </div>

                    <Button
                      onClick={() => markComplete.mutate({ id: client.id })}
                      disabled={markComplete.isPending}
                      className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground h-9 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </PageShell>
  );
}
