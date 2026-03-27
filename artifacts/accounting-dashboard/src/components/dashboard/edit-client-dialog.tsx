import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Save, Loader2, Building2, CalendarDays, Clock } from "lucide-react";
import { Client } from "@workspace/api-client-react";
import { useClientMutations } from "@/hooks/use-clients";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const TIMEZONES: string[] =
  typeof Intl !== "undefined" && (Intl as any).supportedValuesOf
    ? (Intl as any).supportedValuesOf("timeZone")
    : [
        "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Amsterdam",
        "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
        "Asia/Dubai", "Asia/Kolkata", "Australia/Sydney",
      ];

interface EditClientDialogProps {
  client: Client | null;
  onClose: () => void;
}

interface FormValues {
  clientName: string;
  clientEmail: string;
  dueDate: string;
  notes: string;
  bufferDays: string;
  assigneeTimezone: string;
}

export function EditClientDialog({ client, onClose }: EditClientDialogProps) {
  const { update } = useClientMutations();

  const form = useForm<FormValues>({
    defaultValues: {
      clientName: "",
      clientEmail: "",
      dueDate: "",
      notes: "",
      bufferDays: "",
      assigneeTimezone: "__none__",
    },
  });

  useEffect(() => {
    if (!client) return;
    form.reset({
      clientName: client.clientName ?? "",
      clientEmail: client.clientEmail ?? "",
      dueDate: client.dueDate ? client.dueDate.split("T")[0] : "",
      notes: client.notes ?? "",
      bufferDays: client.bufferDays != null ? String(client.bufferDays) : "",
      assigneeTimezone: client.assigneeTimezone ?? "__none__",
    });
  }, [client]);

  const onSubmit = (values: FormValues) => {
    if (!client) return;
    update.mutate(
      {
        id: client.id,
        data: {
          clientName: values.clientName.trim() || undefined,
          clientEmail: values.clientEmail.trim() || null,
          dueDate: values.dueDate || undefined,
          notes: values.notes.trim() || null,
          bufferDays: values.bufferDays !== "" ? Number(values.bufferDays) : null,
          assigneeTimezone:
            values.assigneeTimezone === "__none__" ? null : values.assigneeTimezone || null,
        },
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open={!!client} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] bg-card rounded-2xl overflow-hidden p-0 border-border/50 shadow-2xl">
        <div className="p-6 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Edit Deadline
            </DialogTitle>
            <DialogDescription className="mt-1">
              <span className="font-semibold text-foreground">{client?.clientName}</span>
              {" — "}
              <span className="text-muted-foreground">{client?.deadlineType}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">

              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Client Name
                    </FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10 rounded-xl bg-muted/40 border-border" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Client Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="client@example.com"
                        className="h-10 rounded-xl bg-muted/40 border-border"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" /> Due Date
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="h-10 rounded-xl bg-muted/40 border-border"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bufferDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Buffer Days
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          max="90"
                          placeholder="3"
                          className="h-10 rounded-xl bg-muted/40 border-border"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assigneeTimezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Timezone
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 rounded-xl bg-muted/40 border-border">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-52">
                          <SelectItem value="__none__">None</SelectItem>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Notes
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Any additional notes..."
                        className="rounded-xl bg-muted/40 border-border resize-none"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={update.isPending}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {update.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {update.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
