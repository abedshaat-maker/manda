import { useState, useMemo } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Download, Send, Trash2, CheckCircle2, Clock, AlertTriangle,
  FileText, Search, Loader2,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, parseISO } from "date-fns";
import { CreateInvoiceDialog } from "@/components/dashboard/create-invoice-dialog";

interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  company_number: string | null;
  client_name: string;
  client_email: string;
  client_address: string | null;
  issue_date: string;
  due_date: string;
  status: "draft" | "sent" | "paid" | "overdue";
  notes: string | null;
  items: InvoiceItem[];
  created_at: string;
}

function calcTotal(items: InvoiceItem[]) {
  return items.reduce((sum, item) => {
    const net = item.quantity * item.unit_price;
    return sum + net + net * (item.vat_rate / 100);
  }, 0);
}

function statusInfo(inv: Invoice) {
  const s = inv.status;
  if (s === "paid") return { label: "Paid", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
  if (s === "sent" && isPast(parseISO(inv.due_date))) return { label: "Overdue", cls: "bg-red-100 text-red-700", icon: AlertTriangle };
  if (s === "sent") return { label: "Sent", cls: "bg-blue-100 text-blue-700", icon: Send };
  return { label: "Draft", cls: "bg-gray-100 text-gray-600", icon: Clock };
}

function fmtDate(iso: string) {
  try { return format(parseISO(iso.slice(0, 10)), "d MMM yyyy"); } catch { return iso; }
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-card border border-border/60 rounded-xl px-5 py-4 shadow-sm">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: () => customFetch<Invoice[]>("/api/invoices"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.client_name.toLowerCase().includes(q) ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.client_email.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  // KPIs
  const totalOutstanding = useMemo(() => invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + calcTotal(i.items), 0), [invoices]);
  const totalPaid = useMemo(() => invoices.filter((i) => i.status === "paid").reduce((s, i) => s + calcTotal(i.items), 0), [invoices]);
  const overdueCount = useMemo(() => invoices.filter((i) => i.status === "sent" && isPast(parseISO(i.due_date))).length, [invoices]);
  const draftCount = useMemo(() => invoices.filter((i) => i.status === "draft").length, [invoices]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  async function sendInvoice(id: number) {
    setSendingId(id);
    try {
      await customFetch(`/api/invoices/${id}/send`, { method: "POST" });
      toast({ title: "Invoice sent", description: "PDF emailed to the client." });
      refresh();
    } catch {
      toast({ title: "Failed to send invoice", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  }

  async function markPaid(id: number) {
    setLoadingId(id);
    try {
      await customFetch(`/api/invoices/${id}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
      toast({ title: "Invoice marked as paid" });
      refresh();
    } catch {
      toast({ title: "Failed to update invoice", variant: "destructive" });
    } finally {
      setLoadingId(null);
      setMarkPaidId(null);
    }
  }

  async function deleteInvoice(id: number) {
    setLoadingId(id);
    try {
      await customFetch(`/api/invoices/${id}`, { method: "DELETE" });
      toast({ title: "Invoice deleted" });
      refresh();
    } catch {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    } finally {
      setLoadingId(null);
      setDeleteId(null);
    }
  }

  function downloadPdf(inv: Invoice) {
    const token = localStorage.getItem("adm_auth_token");
    const a = document.createElement("a");
    a.href = `/api/invoices/${inv.id}/pdf`;
    if (token) a.href += `?_t=${Date.now()}`;
    a.download = `${inv.invoice_number}.pdf`;
    // open in new tab for authenticated download
    window.open(`/api/invoices/${inv.id}/pdf`, "_blank");
  }

  return (
    <PageShell
      title="Invoices"
      subtitle="Create, send and track invoices for your clients"
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Invoice
        </Button>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Outstanding" value={`£${totalOutstanding.toFixed(2)}`} color="text-foreground" />
        <KpiCard label="Paid" value={`£${totalPaid.toFixed(2)}`} color="text-emerald-600" />
        <KpiCard label="Overdue" value={overdueCount} color="text-destructive" />
        <KpiCard label="Drafts" value={draftCount} color="text-muted-foreground" />
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search invoices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">
            {invoices.length === 0 ? "No invoices yet" : "No results match your search"}
          </p>
          {invoices.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Click <strong>New Invoice</strong> to create your first one.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-5 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Invoice</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Issue Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Due Date</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Amount</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((inv) => {
                const { label, cls, icon: StatusIcon } = statusInfo(inv);
                const total = calcTotal(inv.items);
                const isPaid = inv.status === "paid";
                const isBusy = loadingId === inv.id || sendingId === inv.id;

                return (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-semibold text-xs text-primary">{inv.invoice_number}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground truncate max-w-[160px]">{inv.client_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{inv.client_email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{fmtDate(inv.issue_date)}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums">£{total.toFixed(2)}</td>
                    <td className="px-4 py-3.5">
                      <Badge className={`${cls} text-[10px] font-semibold gap-1 border-0`}>
                        <StatusIcon className="w-3 h-3" />
                        {label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* Download PDF */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => downloadPdf(inv)}>
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download PDF</TooltipContent>
                        </Tooltip>

                        {/* Send */}
                        {!isPaid && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                                onClick={() => sendInvoice(inv.id)}
                                disabled={isBusy}
                              >
                                {sendingId === inv.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Send className="w-3.5 h-3.5" />
                                }
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send to client</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Mark paid */}
                        {!isPaid && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
                                onClick={() => setMarkPaidId(inv.id)}
                                disabled={isBusy}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark as paid</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Delete */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteId(inv.id)}
                              disabled={isBusy}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete invoice</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialogs */}
      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />

      <AlertDialog open={markPaidId !== null} onOpenChange={(o) => !o && setMarkPaidId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Paid?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the invoice as paid. You can't undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => markPaidId && markPaid(markPaidId)}>Mark Paid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the invoice and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && deleteInvoice(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
