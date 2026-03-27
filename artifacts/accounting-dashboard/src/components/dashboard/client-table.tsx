import { useState, useMemo } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  Search, Download, CheckCircle2, Mail, Trash2, ArrowUpDown, Undo2
} from "lucide-react";
import { useListClients, useExportClients, Client } from "@workspace/api-client-react";
import { useClientMutations } from "@/hooks/use-clients";
import { getComputedStatus, getDaysLeft } from "@/lib/client-utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmailPreviewDialog } from "./email-preview-dialog";
import { AddClientDialog } from "./add-client-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { getExportClientsQueryKey, exportClients } from "@workspace/api-client-react";

type FilterStatus = "All" | "overdue" | "due_soon" | "pending" | "completed";

interface ClientGroup {
  key: string;
  clientName: string;
  companyNumber: string;
  companyName: string;
  deadlines: Client[];
}

const StatusBadge = ({ client }: { client: Client }) => {
  const status = getComputedStatus(client);
  switch (status) {
    case "overdue":
      return <Badge variant="destructive" className="bg-destructive/15 text-destructive border-0 rounded-full px-3 py-1 font-semibold shadow-none">Overdue</Badge>;
    case "due_soon":
      return <Badge className="bg-orange-500/15 text-orange-600 border-0 rounded-full px-3 py-1 font-semibold shadow-none">Due Soon</Badge>;
    case "completed":
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-0 rounded-full px-3 py-1 font-semibold shadow-none">Completed</Badge>;
    default:
      return <Badge className="bg-blue-500/15 text-blue-600 border-0 rounded-full px-3 py-1 font-semibold shadow-none">Pending</Badge>;
  }
};

export function ClientTable() {
  const { data: clients, isLoading } = useListClients();
  const { markComplete, remove, revertPending } = useClientMutations();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("All");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: getExportClientsQueryKey(),
        queryFn: () => exportClients(),
      });
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Deadlines");
      XLSX.writeFile(workbook, `accounting-deadlines-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const groupedClients = useMemo<ClientGroup[]>(() => {
    if (!clients) return [];

    const filtered = clients.filter((c) => {
      const matchSearch =
        c.clientName.toLowerCase().includes(search.toLowerCase()) ||
        c.companyNumber.includes(search) ||
        c.companyName.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filter === "All") return true;
      return getComputedStatus(c) === filter;
    });

    const map = new Map<string, Client[]>();
    for (const c of filtered) {
      const key = c.companyNumber || `name::${c.clientName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }

    return Array.from(map.entries())
      .map(([key, deadlines]) => ({
        key,
        clientName: deadlines[0].clientName,
        companyNumber: deadlines[0].companyNumber,
        companyName: deadlines[0].companyName,
        deadlines: [...deadlines].sort(
          (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        ),
      }))
      .sort((a, b) =>
        new Date(a.deadlines[0].dueDate).getTime() -
        new Date(b.deadlines[0].dueDate).getTime()
      );
  }, [clients, search, filter]);

  const DeadlineActions = ({ client }: { client: Client }) => (
    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {client.status !== "completed" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => markComplete.mutate({ id: client.id })}
              className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark Complete</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => revertPending(client.id)}
              className="h-8 w-8 text-orange-500 hover:bg-orange-500/10 hover:text-orange-600"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo — move back to Pending</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPreviewId(client.id)}
            className="h-8 w-8 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
          >
            <Mail className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send Email Reminder</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm("Delete this deadline?")) remove.mutate({ id: client.id });
            }}
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 hide-scrollbar">
          {(["All", "overdue", "due_soon", "pending", "completed"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(f)}
              className={`rounded-full capitalize ${filter === f ? "shadow-md shadow-primary/20" : "bg-muted/50 hover:bg-muted"}`}
            >
              {f.replace("_", " ")}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl bg-card border-border/50 shadow-sm focus:ring-primary/20"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="rounded-xl border-border/50 bg-card hover:bg-muted/50 shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "..." : "Export"}
          </Button>
          <AddClientDialog />
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-6 py-4 font-semibold">Company No.</th>
                <th className="px-6 py-4 font-semibold">Deadline Type</th>
                <th className="px-6 py-4 font-semibold">
                  <div className="flex items-center gap-1">
                    Due Date <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold">Days Left</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : groupedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <img
                        src={`${import.meta.env.BASE_URL}images/empty-state.png`}
                        alt="No clients"
                        className="w-40 h-40 opacity-50 mix-blend-multiply mb-4"
                      />
                      <p className="text-lg font-medium text-foreground">No deadlines found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or add a new client.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                groupedClients.map((group) =>
                  group.deadlines.map((client, idx) => {
                    const daysLeft = getDaysLeft(client.dueDate);
                    const isOverdue = daysLeft < 0 && client.status !== "completed";
                    const isFirst = idx === 0;
                    const isLast = idx === group.deadlines.length - 1;
                    const hasMultiple = group.deadlines.length > 1;

                    return (
                      <tr
                        key={client.id}
                        className={`hover:bg-muted/30 transition-colors group ${
                          hasMultiple && !isLast ? "border-b-0" : ""
                        } ${hasMultiple && !isFirst ? "bg-muted/10" : ""}`}
                      >
                        {/* Client name — only shown on first row of group, spans remaining rows via visual grouping */}
                        <td className="px-6 py-3">
                          {isFirst ? (
                            <>
                              <div className="font-semibold text-foreground">{group.clientName}</div>
                              {group.companyName !== group.clientName && (
                                <div className="text-xs text-muted-foreground mt-0.5">{group.companyName}</div>
                              )}
                              {hasMultiple && (
                                <div className="text-xs text-primary/70 mt-1 font-medium">
                                  {group.deadlines.length} deadlines
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="pl-3 border-l-2 border-border/50 text-xs text-muted-foreground italic">
                              ↳ same client
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-3 font-mono text-muted-foreground">
                          {isFirst ? group.companyNumber : ""}
                        </td>

                        <td className="px-6 py-3 text-foreground font-medium">
                          {client.deadlineType}
                        </td>

                        <td className="px-6 py-3 text-muted-foreground">
                          {format(new Date(client.dueDate), "MMM dd, yyyy")}
                        </td>

                        <td className="px-6 py-3">
                          {client.status === "completed" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={`font-semibold ${
                                isOverdue
                                  ? "text-destructive"
                                  : daysLeft <= 14
                                  ? "text-orange-500"
                                  : "text-foreground"
                              }`}
                            >
                              {isOverdue ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-3">
                          <StatusBadge client={client} />
                        </td>

                        <td className="px-6 py-3">
                          <DeadlineActions client={client} />
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmailPreviewDialog clientId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}
