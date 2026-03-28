import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { customFetch, useListClients } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  prefillCompanyNumber?: string;
}

const VAT_OPTIONS = [
  { label: "20% Standard", value: "20" },
  { label: "5% Reduced", value: "5" },
  { label: "0% Zero", value: "0" },
];

function emptyItem(): LineItem {
  return { description: "", quantity: "1", unit_price: "", vat_rate: "20" };
}

function calcTotals(items: LineItem[]) {
  let subtotal = 0;
  let vat = 0;
  for (const item of items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const vatRate = parseFloat(item.vat_rate) || 0;
    const net = qty * price;
    subtotal += net;
    vat += net * (vatRate / 100);
  }
  return { subtotal, vat, total: subtotal + vat };
}

export function CreateInvoiceDialog({ open, onOpenChange, onCreated, prefillCompanyNumber }: Props) {
  const { toast } = useToast();
  const { data: clients = [] } = useListClients();

  const [saving, setSaving] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("__none__");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  // Unique company groups from clients list
  const companies = Array.from(
    new Map(clients.filter((c) => !c.isArchived).map((c) => [c.companyNumber, c])).values()
  ).sort((a, b) => a.clientName.localeCompare(b.clientName));

  useEffect(() => {
    if (!open) return;
    setSelectedCompany(prefillCompanyNumber ?? "__none__");
    setClientName("");
    setClientEmail("");
    setClientAddress("");
    setIssueDate(format(new Date(), "yyyy-MM-dd"));
    setDueDate("");
    setNotes("");
    setItems([emptyItem()]);
  }, [open, prefillCompanyNumber]);

  // Prefill from client data when a company is selected
  useEffect(() => {
    if (selectedCompany === "__none__") return;
    const match = clients.find((c) => c.companyNumber === selectedCompany);
    if (!match) return;
    setClientName(match.clientName);
    setClientEmail(match.clientEmail || "");
  }, [selectedCompany, clients]);

  function setItem(i: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const { subtotal, vat, total } = calcTotals(items);

  async function handleSubmit() {
    if (!clientName.trim() || !clientEmail.trim() || !issueDate || !dueDate) {
      toast({ title: "Please fill in client name, email and dates", variant: "destructive" });
      return;
    }
    if (items.some((i) => !i.description.trim() || !i.unit_price)) {
      toast({ title: "Each line item needs a description and price", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await customFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          company_number: selectedCompany === "__none__" ? undefined : selectedCompany,
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          client_address: clientAddress.trim() || undefined,
          issue_date: issueDate,
          due_date: dueDate,
          notes: notes.trim() || undefined,
          items: items.map((i) => ({
            description: i.description.trim(),
            quantity: parseFloat(i.quantity) || 1,
            unit_price: parseFloat(i.unit_price) || 0,
            vat_rate: parseFloat(i.vat_rate) || 0,
          })),
        }),
      });
      toast({ title: "Invoice created" });
      onOpenChange(false);
      onCreated();
    } catch {
      toast({ title: "Failed to create invoice", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Client selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link to Client</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No client linked —</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.companyNumber} value={c.companyNumber}>
                      {c.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Email *</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bill To (Name) *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client or company name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Address</Label>
              <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Address (optional)" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issue Date *</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</Label>
              <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add line
              </Button>
            </div>

            {/* Column headers */}
            <div className="grid gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-1"
              style={{ gridTemplateColumns: "1fr 80px 110px 120px 30px" }}>
              <span>Description</span>
              <span>Qty</span>
              <span>Unit Price (£)</span>
              <span>VAT</span>
              <span />
            </div>

            {items.map((item, i) => (
              <div key={i} className="grid gap-2 items-center"
                style={{ gridTemplateColumns: "1fr 80px 110px 120px 30px" }}>
                <Input
                  placeholder="e.g. Annual accounts preparation"
                  value={item.description}
                  onChange={(e) => setItem(i, "description", e.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={item.quantity}
                  onChange={(e) => setItem(i, "quantity", e.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={item.unit_price}
                  onChange={(e) => setItem(i, "unit_price", e.target.value)}
                />
                <Select value={item.vat_rate} onValueChange={(v) => setItem(i, "vat_rate", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => items.length > 1 && removeItem(i)} disabled={items.length === 1}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            {/* Totals */}
            <div className="mt-3 border-t border-border/60 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>VAT</span>
                <span>£{vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground border-t border-border/60 pt-1.5 mt-1.5">
                <span>Total Due</span>
                <span>£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, bank details, etc."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
