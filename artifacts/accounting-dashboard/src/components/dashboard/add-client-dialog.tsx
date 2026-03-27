import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Building2, Search, Plus, Trash2, Briefcase } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { lookupCompany, getLookupCompanyQueryKey, useListClients } from "@workspace/api-client-react";
import { useClientMutations } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const DEADLINE_TYPES_COMPANY = [
  "Annual Accounts", "Confirmation Statement", "VAT Return", "Corporation Tax", "PAYE",
];
const DEADLINE_TYPES_SELF_EMPLOYED = [
  "Self Assessment", "VAT Return", "PAYE",
];

// Common timezones relevant for UK accountants
const TIMEZONES = typeof Intl !== "undefined" && (Intl as any).supportedValuesOf
  ? (Intl as any).supportedValuesOf("timeZone") as string[]
  : [
      "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Amsterdam",
      "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "Asia/Dubai", "Asia/Kolkata", "Australia/Sydney",
    ];

type ClientType = "limited" | "self-employed";

interface DeadlineItem {
  id: string;
  type: string;
  date: string;
  selected: boolean;
  bufferDays: number;
  linkedDeadlineId: string | null;
}

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [clientType, setClientType] = useState<ClientType>("limited");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [timezone, setTimezone] = useState<string>("");

  const { create } = useClientMutations();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allClients = [] } = useListClients();

  const form = useForm({
    defaultValues: {
      companyNumber: "",
      companyName: "",
      clientName: "",
      clientEmail: "",
      notes: "",
    },
  });

  const deadlineTypes = clientType === "self-employed" ? DEADLINE_TYPES_SELF_EMPLOYED : DEADLINE_TYPES_COMPANY;

  // Feature 4: Existing deadlines for same company (for "Depends on" dropdown)
  const companyNumber = form.watch("companyNumber");
  const existingDeadlinesForCompany = useMemo(() => {
    if (!companyNumber) return [];
    return allClients.filter((c) => c.companyNumber === companyNumber && c.status !== "completed");
  }, [allClients, companyNumber]);

  const handleTypeSwitch = (type: ClientType) => {
    setClientType(type);
    form.reset();
    setDeadlines([]);
    setTimezone("");
  };

  const handleLookup = async () => {
    const num = form.getValues("companyNumber");
    if (!num) {
      toast({ title: "Required", description: "Please enter a company number", variant: "destructive" });
      return;
    }
    setIsLookingUp(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: getLookupCompanyQueryKey(num),
        queryFn: () => lookupCompany(num),
      });
      form.setValue("companyName", data.companyName);
      const newDeadlines: DeadlineItem[] = [];
      if (data.accountsDueDate) newDeadlines.push({ id: "acc", type: "Annual Accounts", date: data.accountsDueDate, selected: true, bufferDays: 3, linkedDeadlineId: null });
      if (data.confirmationStatementDueDate) newDeadlines.push({ id: "cs", type: "Confirmation Statement", date: data.confirmationStatementDueDate, selected: true, bufferDays: 3, linkedDeadlineId: null });
      if (data.vatReturnDueDate) newDeadlines.push({ id: "vat", type: "VAT Return", date: data.vatReturnDueDate, selected: true, bufferDays: 3, linkedDeadlineId: null });
      setDeadlines(newDeadlines);
      toast({ title: "Success", description: "Company details found." });
    } catch (error: any) {
      const status = error?.status;
      if (status === 401) {
        toast({ title: "Session expired", description: "Please refresh the page and log in again.", variant: "destructive" });
      } else if (status === 404) {
        toast({ title: "Not Found", description: "Could not find a company with that number on Companies House.", variant: "destructive" });
      } else {
        toast({ title: "Lookup failed", description: error?.message || "Could not look up company. Please try again.", variant: "destructive" });
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const addManualDeadline = () => {
    setDeadlines([...deadlines, {
      id: Math.random().toString(),
      type: deadlineTypes[0],
      date: format(new Date(), "yyyy-MM-dd"),
      selected: true,
      bufferDays: 3,
      linkedDeadlineId: null,
    }]);
  };

  const removeDeadline = (id: string) => setDeadlines(deadlines.filter(d => d.id !== id));
  const updateDeadline = (id: string, field: keyof DeadlineItem, value: any) => {
    setDeadlines(deadlines.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const onSubmit = async (values: any) => {
    const selectedDeadlines = deadlines.filter(d => d.selected);
    if (selectedDeadlines.length === 0) {
      toast({ title: "Required", description: "Please add at least one deadline.", variant: "destructive" });
      return;
    }
    const isSelfEmployed = clientType === "self-employed";
    const clientName = values.clientName || values.companyName;
    const companyNum = isSelfEmployed
      ? `SE-${clientName.replace(/\s+/g, "-").toUpperCase()}`
      : (values.companyNumber || "N/A");
    const companyName = isSelfEmployed
      ? (values.companyName || clientName)
      : (values.companyName || "N/A");

    try {
      await Promise.all(
        selectedDeadlines.map(deadline =>
          create.mutateAsync({
            data: {
              clientName,
              clientEmail: values.clientEmail || null,
              companyNumber: companyNum,
              companyName,
              deadlineType: deadline.type,
              dueDate: deadline.date,
              status: "pending",
              notes: values.notes
                ? (isSelfEmployed ? `[Self Employed] ${values.notes}` : values.notes)
                : isSelfEmployed ? "[Self Employed]" : values.notes || null,
              bufferDays: deadline.bufferDays || null,
              linkedDeadlineId: deadline.linkedDeadlineId || null,
              assigneeTimezone: timezone || null,
            }
          })
        )
      );
      setOpen(false);
      form.reset();
      setDeadlines([]);
      setClientType("limited");
      setTimezone("");
    } catch {
      // Errors handled by mutation hook
    }
  };

  const resetAll = () => { form.reset(); setDeadlines([]); setClientType("limited"); setTimezone(""); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetAll(); }}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 rounded-xl px-6">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[620px] bg-card p-0 overflow-hidden border-border/50 shadow-2xl rounded-2xl">
        <div className="p-6 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              {clientType === "self-employed" ? <Briefcase className="w-6 h-6 text-primary" /> : <Building2 className="w-6 h-6 text-primary" />}
              Add Client &amp; Deadlines
            </DialogTitle>
            <DialogDescription>
              {clientType === "limited"
                ? "Lookup a company from Companies House to auto-fill details, or enter manually."
                : "Add a self-employed client and their upcoming tax deadlines."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {/* Client type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-border/60 mb-6">
            <button type="button" onClick={() => handleTypeSwitch("limited")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${clientType === "limited" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}>
              <Building2 className="w-4 h-4" />Limited Company
            </button>
            <button type="button" onClick={() => handleTypeSwitch("self-employed")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${clientType === "self-employed" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}>
              <Briefcase className="w-4 h-4" />Self Employed
            </button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {clientType === "limited" && (
                <div className="flex gap-4 items-end">
                  <FormField control={form.control} name="companyNumber" render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-foreground/80">Company Number</FormLabel>
                      <FormControl><Input placeholder="e.g. 12345678" className="bg-background rounded-xl border-border focus:ring-primary/20" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <Button type="button" variant="secondary" onClick={handleLookup} disabled={isLookingUp} className="rounded-xl px-6 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    {isLookingUp ? "Searching..." : <><Search className="w-4 h-4 mr-2" />Lookup</>}
                  </Button>
                </div>
              )}

              <div className={`grid gap-4 ${clientType === "limited" ? "grid-cols-2" : "grid-cols-1"}`}>
                {clientType === "limited" && (
                  <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Company Name</FormLabel>
                      <FormControl><Input placeholder="Acme Ltd" className="bg-background rounded-xl" {...field} /></FormControl>
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">{clientType === "self-employed" ? "Full Name / Trading Name" : "Client Contact Name"}</FormLabel>
                    <FormControl><Input placeholder={clientType === "self-employed" ? "Jane Smith" : "John Doe"} className="bg-background rounded-xl" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              {clientType === "self-employed" && (
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Trading / Business Name (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. Jane Smith Consulting" className="bg-background rounded-xl" {...field} /></FormControl>
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="clientEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Client Email (for reminders)</FormLabel>
                  <FormControl><Input type="email" placeholder="client@example.com" className="bg-background rounded-xl" {...field} /></FormControl>
                </FormItem>
              )} />

              {/* Feature 6: Timezone selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Client Timezone (Optional)</label>
                <Select value={timezone || "__none__"} onValueChange={(v) => setTimezone(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-background rounded-xl">
                    <SelectValue placeholder="Select timezone (optional)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none__">None</SelectItem>
                    {TIMEZONES.slice(0, 200).map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Filing Deadlines</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addManualDeadline} className="rounded-lg h-8">
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>

                {deadlines.length === 0 ? (
                  <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">
                      {clientType === "limited" ? "No deadlines added yet. Lookup a company or add manually." : "Click '+ Add' to add a deadline."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deadlines.map((deadline) => (
                      <div key={deadline.id} className="bg-muted/30 p-3 rounded-xl border border-border/50 space-y-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={deadline.selected}
                            onCheckedChange={(c) => updateDeadline(deadline.id, "selected", !!c)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <Select value={deadline.type} onValueChange={(v) => updateDeadline(deadline.id, "type", v)}>
                              <SelectTrigger className="bg-background rounded-lg h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {deadlineTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input type="date" value={deadline.date} onChange={(e) => updateDeadline(deadline.id, "date", e.target.value)} className="bg-background rounded-lg h-9" />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeDeadline(deadline.id)} className="h-9 w-9 text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Feature 3: Buffer days input */}
                        <div className="flex items-center gap-3 pl-7">
                          <div className="flex items-center gap-2 flex-1">
                            <label className="text-xs text-muted-foreground whitespace-nowrap">Working buffer (days before deadline):</label>
                            <Input
                              type="number"
                              min={0}
                              max={90}
                              value={deadline.bufferDays}
                              onChange={(e) => updateDeadline(deadline.id, "bufferDays", parseInt(e.target.value) || 0)}
                              className="bg-background rounded-lg h-7 w-20 text-xs"
                            />
                          </div>

                          {/* Feature 4: Depends on dropdown (existing deadlines for same company) */}
                          {existingDeadlinesForCompany.length > 0 && (
                            <div className="flex items-center gap-2 flex-1">
                              <label className="text-xs text-muted-foreground whitespace-nowrap">Depends on:</label>
                              <Select
                                value={deadline.linkedDeadlineId ?? "__none__"}
                                onValueChange={(v) => updateDeadline(deadline.id, "linkedDeadlineId", v === "__none__" ? null : v)}
                              >
                                <SelectTrigger className="bg-background rounded-lg h-7 text-xs flex-1">
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">None</SelectItem>
                                  {existingDeadlinesForCompany.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.deadlineType} ({c.dueDate})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Notes (Optional)</FormLabel>
                  <FormControl><Input placeholder="Additional details..." className="bg-background rounded-xl" {...field} /></FormControl>
                </FormItem>
              )} />

              <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={create.isPending} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                  {create.isPending ? "Saving..." : "Save Deadlines"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
