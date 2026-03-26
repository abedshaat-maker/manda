import { Sidebar } from "@/components/layout/sidebar";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const { changePassword } = useAuth();

  const [firm, setFirm] = useState(() => localStorage.getItem("firm_name") || "");
  const [accountant, setAccountant] = useState(() => localStorage.getItem("accountant_name") || "");
  const [email, setEmail] = useState(() => localStorage.getItem("accountant_email") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("accountant_phone") || "");

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleSave = () => {
    localStorage.setItem("firm_name", firm);
    localStorage.setItem("accountant_name", accountant);
    localStorage.setItem("accountant_email", email);
    localStorage.setItem("accountant_phone", phone);
    toast({ title: "Settings saved", description: "Your preferences have been updated." });
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast({ title: "Error", description: "All password fields are required.", variant: "destructive" });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPwd.length < 6) {
      toast({ title: "Error", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setPwdLoading(true);
    const err = await changePassword(currentPwd, newPwd);
    setPwdLoading(false);
    if (err) {
      toast({ title: "Error", description: err, variant: "destructive" });
    } else {
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    }
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
                  <Input value={firm} onChange={e => setFirm(e.target.value)} placeholder="e.g. Smith & Partners Accountants" className="rounded-xl bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Accountant Name</label>
                  <Input value={accountant} onChange={e => setAccountant(e.target.value)} placeholder="e.g. John Smith" className="rounded-xl bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Email Address</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. john@smithpartners.co.uk" className="rounded-xl bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Phone Number</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 020 7946 0000" className="rounded-xl bg-background" />
                </div>
              </div>
              <Button onClick={handleSave} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-8 shadow-md shadow-primary/20">
                Save Settings
              </Button>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h2 className="font-semibold text-foreground text-base">Change Password</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Update your login password</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Current Password</label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      placeholder="Enter current password"
                      className="rounded-xl bg-background pr-10"
                    />
                    <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      placeholder="Enter new password (min. 6 characters)"
                      className="rounded-xl bg-background pr-10"
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Confirm New Password</label>
                  <Input
                    type="password"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="Repeat new password"
                    className="rounded-xl bg-background"
                  />
                </div>
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
                variant="outline"
                className="rounded-xl px-8"
              >
                {pwdLoading ? "Updating..." : "Change Password"}
              </Button>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-foreground text-base">About</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><span className="text-foreground font-medium">Application:</span> Accounting Deadline Manager</p>
                <p><span className="text-foreground font-medium">Data source:</span> Companies House API</p>
                <p><span className="text-foreground font-medium">Data storage:</span> PostgreSQL database</p>
                <p><span className="text-foreground font-medium">Version:</span> 1.0.0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
