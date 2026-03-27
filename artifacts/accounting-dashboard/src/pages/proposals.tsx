import { PageShell } from "@/components/layout/page-shell";
import { customFetch, Client, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { GitPullRequest, CheckCircle2, XCircle, CalendarDays, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

function useProposals() {
  return useQuery<Client[]>({
    queryKey: ["proposals"],
    queryFn: async () => {
      const data = await customFetch<Client[]>("/api/proposals", { method: "GET" });
      return data ?? [];
    },
    refetchInterval: 15_000,
  });
}

export default function ProposalsPage() {
  const { data: proposals = [], isLoading, refetch } = useProposals();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["proposals"] });
    qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
  };

  const handleAccept = async (client: Client) => {
    setLoadingId(client.id + "-accept");
    try {
      await customFetch(`/api/clients/${client.id}/accept-proposal`, { method: "PUT" });
      toast({ title: "Proposal accepted", description: `Due date updated to ${client.proposedDueDate ? format(new Date(client.proposedDueDate), "MMM dd, yyyy") : "new date"}.` });
      invalidate();
    } catch {
      toast({ title: "Error", description: "Failed to accept proposal.", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (client: Client) => {
    setLoadingId(client.id + "-reject");
    try {
      await customFetch(`/api/clients/${client.id}/reject-proposal`, { method: "PUT" });
      toast({ title: "Proposal rejected", description: "The original due date has been kept." });
      invalidate();
    } catch {
      toast({ title: "Error", description: "Failed to reject proposal.", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <PageShell
      title={<span className="flex items-center gap-2"><GitPullRequest className="w-5 h-5 text-accent" />Date Extension Proposals</span>}
      description="Review and action proposed due date changes from the client table."
    >
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border/50">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
            <GitPullRequest className="w-8 h-8 text-violet-500" />
          </div>
          <p className="text-xl font-semibold text-foreground">No pending proposals</p>
          <p className="text-sm mt-1">Use the calendar clock icon in the deadline table to propose a new date.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {proposals.map((client) => (
            <Card key={client.id} className="rounded-2xl border border-violet-500/20 bg-violet-500/5 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-base truncate">{client.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{client.companyName}</p>
                  </div>
                  <Badge className="bg-violet-500/15 text-violet-600 border-0 rounded-full px-3 py-0.5 text-xs font-semibold flex-shrink-0">
                    Pending
                  </Badge>
                </div>

                <div className="bg-card rounded-xl border border-border/50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-foreground">{client.deadlineType}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Current: <span className="font-medium text-foreground">{format(new Date(client.dueDate), "MMM dd, yyyy")}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-violet-600 font-medium text-sm">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Proposed: <span className="font-bold">{client.proposedDueDate ? format(new Date(client.proposedDueDate), "MMM dd, yyyy") : "—"}</span></span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAccept(client)}
                    disabled={loadingId === client.id + "-accept"}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {loadingId === client.id + "-accept" ? "Accepting..." : "Accept"}
                  </Button>
                  <Button
                    onClick={() => handleReject(client)}
                    disabled={loadingId === client.id + "-reject"}
                    variant="outline"
                    className="flex-1 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 h-9 text-sm"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    {loadingId === client.id + "-reject" ? "Rejecting..." : "Reject"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
