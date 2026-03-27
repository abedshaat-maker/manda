import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { PageShell } from "@/components/layout/page-shell";
import { useListClients, useLookupCompany } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { getDaysLeft, getComputedStatus } from "@/lib/client-utils";
import { Building2, ArrowLeft, Phone, User, Calendar, CheckCircle2, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

function useDirectors(companyNumber: string | undefined) {
  return useQuery({
    queryKey: ["directors", companyNumber],
    queryFn: async () => {
      if (!companyNumber || companyNumber.startsWith("SE-")) return [];
      const res = await customFetch<any>(`/api/company/${companyNumber}/directors`, { method: "GET" });
      return res ?? [];
    },
    enabled: !!companyNumber && !companyNumber.startsWith("SE-"),
  });
}

function statusLabel(status: string) {
  if (status === "overdue") return { label: "Overdue", cls: "bg-red-100 text-red-700" };
  if (status === "due_soon") return { label: "Due soon", cls: "bg-amber-100 text-amber-700" };
  if (status === "completed") return { label: "Completed", cls: "bg-emerald-100 text-emerald-700" };
  return { label: "Upcoming", cls: "bg-blue-100 text-blue-700" };
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClientProfilePage() {
  const params = useParams<{ companyNumber: string }>();
  const companyNumber = decodeURIComponent(params.companyNumber ?? "");
  const isSE = companyNumber.startsWith("SE-");

  const { data: clients = [], isLoading: clientsLoading } = useListClients();
  const { data: directors = [], isLoading: directorsLoading } = useDirectors(isSE ? undefined : companyNumber);
  const { data: chData } = useLookupCompany(companyNumber, { query: { enabled: !isSE } });

  const companyClients = useMemo(
    () => clients.filter((c) => c.companyNumber === companyNumber),
    [clients, companyNumber]
  );

  const companyName = companyClients[0]?.companyName ?? chData?.title ?? companyNumber;
  const clientName = companyClients[0]?.clientName ?? "";
  const clientEmail = companyClients[0]?.clientEmail ?? "";

  const sorted = useMemo(
    () => [...companyClients].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [companyClients]
  );

  const pending = sorted.filter((c) => c.status !== "completed");
  const completed = sorted.filter((c) => c.status === "completed");

  if (clientsLoading) {
    return (
      <PageShell title="Client Profile" subtitle="">
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </PageShell>
    );
  }

  if (companyClients.length === 0) {
    return (
      <PageShell title="Client Profile" subtitle="">
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-semibold text-foreground">Client not found</p>
          <Link href="/" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={companyName}
      subtitle={isSE ? "Self Employed Client" : `Company No. ${companyNumber}`}
      actions={
        <Link href="/" className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-medium transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>
      }
    >
      {/* Profile header card */}
      <div className="bg-card border border-border/60 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">{companyName}</h2>
              {isSE ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Self Employed</span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Limited Company</span>
              )}
            </div>
            {!isSE && (
              <p className="text-sm text-muted-foreground mt-0.5">Companies House No. {companyNumber}</p>
            )}
            <div className="flex items-center gap-5 mt-3 text-sm text-muted-foreground">
              {clientName && (
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> {clientName}
                </span>
              )}
              {clientEmail && (
                <a href={`mailto:${clientEmail}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> {clientEmail}
                </a>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold tabular-nums text-foreground">{sorted.length}</p>
            <p className="text-xs text-muted-foreground">deadline{sorted.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deadlines column */}
        <div className="lg:col-span-2 space-y-5">
          {pending.length > 0 && (
            <div className="bg-card border border-border/60 rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Active Deadlines</h3>
                <span className="ml-auto text-xs text-muted-foreground">{pending.length} pending</span>
              </div>
              <div className="divide-y divide-border/40">
                {pending.map((c) => {
                  const days = getDaysLeft(c.dueDate);
                  const status = getComputedStatus(c);
                  const { label, cls } = statusLabel(status);
                  return (
                    <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.deadlineType}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {format(parseISO(c.dueDate), "dd MMMM yyyy")}
                          {c.notes && ` · ${c.notes}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${cls}`}>
                          {status === "overdue" ? `${Math.abs(days)}d overdue` : `${days}d left`}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div className="bg-card border border-border/60 rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-foreground">Completed</h3>
                <span className="ml-auto text-xs text-muted-foreground">{completed.length} filed</span>
              </div>
              <div className="divide-y divide-border/40">
                {completed.map((c) => (
                  <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-4 opacity-70 hover:opacity-100 transition-opacity">
                    <div>
                      <p className="text-sm font-semibold text-foreground line-through decoration-muted-foreground/50">{c.deadlineType}</p>
                      <p className="text-xs text-muted-foreground">Was due {format(parseISO(c.dueDate), "dd MMMM yyyy")}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Completed</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Directors sidebar */}
        {!isSE && (
          <div className="space-y-4">
            <div className="bg-card border border-border/60 rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50">
                <User className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Directors</h3>
              </div>
              {directorsLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (directors as any[]).length === 0 ? (
                <div className="p-5 text-center text-xs text-muted-foreground">
                  No director data available
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {(directors as any[]).map((d: any, i: number) => (
                    <div key={i} className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-foreground">{toTitleCase(d.name)}</p>
                      {d.role && <p className="text-xs text-muted-foreground">{d.role}</p>}
                      {d.phone && (
                        <a
                          href={`tel:${d.phone}`}
                          className="flex items-center gap-1.5 text-xs text-primary mt-1 hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          {d.phone}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
