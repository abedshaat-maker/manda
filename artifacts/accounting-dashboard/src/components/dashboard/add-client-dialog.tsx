import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Search, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { lookupCompany, getLookupCompanyQueryKey } from "@workspace/api-client-react";
import { useClientMutations } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const DEADLINE_TYPES = [
  "Annual Accounts",
  "Confirmation Statement",
  "VAT Return",
  "Self Assessment",
  "Corporation Tax",
  "PAYE"
];

interface DeadlineItem {
  id: string;
  type: string;
  date: string;
  selected: boolean;
}

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  
  const { create } = useClientMutations();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      companyNumber: "",
      companyName: "",
      clientName: "",
      clientEmail: "",
      notes: "",
    },
  });

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
      if (data.accountsDueDate) {
        newDeadlines.push({ id: "acc", type: "Annual Accounts", date: data.accountsDueDate, selected: true });
      }
      if (data.confirmationStatementDueDate) {
        newDeadlines.push({ id: "cs", type: "Confirmation Statement", date: data.confirmationStatementDueDate, selected: true });
      }
      if (data.vatReturnDueDate) {
        newDeadlines.push({ id: "vat", type: "VAT Return", date: data.vatReturnDueDate, selected: true });
      }
      
      setDeadlines(newDeadlines);
      toast({ title: "Success", description: "Company details found." });
    } catch (error) {
      toast({ title: "Not Found", description: "Could not find company with that number.", variant: "destructive" });
    } finally {
      setIsLookingUp(false);
    }
  };

  const addManualDeadline = () => {
    setDeadlines([...deadlines, { id: Math.random().toString(), type: DEADLINE_TYPES[0], date: format(new Date(), "yyyy-MM-dd"), selected: true }]);
  };

  const removeDeadline = (id: string) => {
    setDeadlines(deadlines.filter(d => d.id !== id));
  };

  const updateDeadline = (id: string, field: keyof DeadlineItem, value: any) => {
    setDeadlines(deadlines.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const onSubmit = async (values: any) => {
    const selectedDeadlines = deadlines.filter(d => d.selected);
    if (selectedDeadlines.length === 0) {
      toast({ title: "Required", description: "Please add at least one deadline.", variant: "destructive" });
      return;
    }

    try {
      await Promise.all(
        selectedDeadlines.map(deadline => 
          create.mutateAsync({
            data: {
              clientName: values.clientName || values.companyName,
              clientEmail: values.clientEmail || null,
              companyNumber: values.companyNumber || "N/A",
              companyName: values.companyName || "N/A",
              deadlineType: deadline.type,
              dueDate: deadline.date,
              status: "pending",
              notes: values.notes || null,
            }
          })
        )
      );
      setOpen(false);
      form.reset();
      setDeadlines([]);
    } catch (e) {
      // Errors handled by mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 rounded-xl px-6">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-card p-0 overflow-hidden border-border/50 shadow-2xl rounded-2xl">
        <div className="p-6 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Add Client & Deadlines
            </DialogTitle>
            <DialogDescription>
              Lookup a company from Companies House to auto-fill details, or enter manually.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="flex gap-4 items-end">
                <FormField
                  control={form.control}
                  name="companyNumber"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-foreground/80">Company Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 12345678" className="bg-background rounded-xl border-border focus:ring-primary/20" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleLookup}
                  disabled={isLookingUp}
                  className="rounded-xl px-6 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  {isLookingUp ? "Searching..." : <><Search className="w-4 h-4 mr-2" /> Lookup</>}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Ltd" className="bg-background rounded-xl" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Client Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" className="bg-background rounded-xl" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Client Email (for reminders)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="client@example.com" className="bg-background rounded-xl" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Filing Deadlines</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addManualDeadline} className="rounded-lg h-8">
                    <Plus className="w-3 h-3 mr-1" /> Add Custom
                  </Button>
                </div>

                {deadlines.length === 0 ? (
                  <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">No deadlines added yet.<br/>Lookup a company or add manually.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deadlines.map((deadline) => (
                      <div key={deadline.id} className="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
                        <Checkbox 
                          checked={deadline.selected} 
                          onCheckedChange={(c) => updateDeadline(deadline.id, 'selected', !!c)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <Select value={deadline.type} onValueChange={(v) => updateDeadline(deadline.id, 'type', v)}>
                            <SelectTrigger className="bg-background rounded-lg h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEADLINE_TYPES.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input 
                            type="date" 
                            value={deadline.date} 
                            onChange={(e) => updateDeadline(deadline.id, 'date', e.target.value)}
                            className="bg-background rounded-lg h-9"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeDeadline(deadline.id)} className="h-9 w-9 text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Additional details..." className="bg-background rounded-xl" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

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
