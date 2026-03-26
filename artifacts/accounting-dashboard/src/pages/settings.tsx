import { Sidebar } from "@/components/layout/sidebar";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [firm, setFirm] = useState(() => localStorage.getItem("firm_name") || "");
  const [accountant, setAccountant] = useState(() => localStorage.getItem("accountant_name") || "");
  const [email, setEmail] = useState(() => localStorage.getItem("accountant_email") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("accountant_phone") || "");

  const handleSave = () => {
    localStorage.setItem("firm_name", firm);
    localStorage.setItem("accountant_name", accountant);
    localStorage.setItem("accountant_email", email);
    localStorage.setItem("accountant_phone", phone);
    toast({ title: "Settings saved", description: "Your preferences have been updated." });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-xl space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your firm and account preferences</p>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="font-semibold text-foreground text-base">Firm Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Firm Name</label>
                  <Input
                    value={firm}
                    onChange={e => setFirm(e.target.value)}
                    placeholder="e.g. Smith & Partners Accountants"
                    className="rounded-xl bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Accountant Name</label>
                  <Input
                    value={accountant}
                    onChange={e => setAccountant(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="rounded-xl bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Email Address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. john@smithpartners.co.uk"
                    className="rounded-xl bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Phone Number</label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. 020 7946 0000"
                    className="rounded-xl bg-background"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-foreground text-base">About</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><span className="text-foreground font-medium">Application:</span> Accounting Deadline Manager</p>
                <p><span className="text-foreground font-medium">Data source:</span> Companies House API</p>
                <p><span className="text-foreground font-medium">Data storage:</span> Server JSON file</p>
                <p><span className="text-foreground font-medium">Version:</span> 1.0.0</p>
              </div>
            </div>

            <Button
              onClick={handleSave}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-8 shadow-md shadow-primary/20"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
