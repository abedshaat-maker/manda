import { PageShell } from "@/components/layout/page-shell";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { customFetch } from "@workspace/api-client-react";
import {
  Eye, EyeOff, Bell, BellOff, Send, Clock, CheckCircle2, Info,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface NotificationSettings {
  enabled: boolean;
  email: string;
  daysBefore: number;
  sendTime: string;
  lastSentDate: string | null;
}

function useNotificationSettings() {
  return useQuery<NotificationSettings>({
    queryKey: ["notification-settings"],
    queryFn: () => customFetch<NotificationSettings>("/api/notifications/settings", { method: "GET" }),
  });
}

function useSaveNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<NotificationSettings>) =>
      customFetch<NotificationSettings>("/api/notifications/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-settings"] }),
  });
}

function useSendTestNotification() {
  return useMutation({
    mutationFn: () =>
      customFetch<{ success: boolean; message: string }>("/api/notifications/test", { method: "POST" }),
  });
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { changePassword } = useAuth();
  const qc = useQueryClient();

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

  // Notification state
  const { data: notifSettings, isLoading: notifLoading } = useNotificationSettings();
  const saveNotif = useSaveNotificationSettings();
  const sendTest = useSendTestNotification();

  const [notifEmail, setNotifEmail] = useState("");
  const [notifDays, setNotifDays] = useState(7);
  const [notifTime, setNotifTime] = useState("09:00");
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    if (notifSettings) {
      setNotifEmail(notifSettings.email || "");
      setNotifDays(notifSettings.daysBefore ?? 7);
      setNotifTime(notifSettings.sendTime || "09:00");
      setNotifEnabled(notifSettings.enabled);
    }
  }, [notifSettings]);

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
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await saveNotif.mutateAsync({
        enabled: notifEnabled,
        email: notifEmail,
        daysBefore: notifDays,
        sendTime: notifTime,
      });
      toast({ title: "Notification settings saved", description: "Your notification preferences have been updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save notification settings.", variant: "destructive" });
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    setNotifEnabled(enabled);
    try {
      await saveNotif.mutateAsync({ enabled });
      toast({
        title: enabled ? "Notifications enabled" : "Notifications disabled",
        description: enabled
          ? "You'll receive a daily email digest before deadlines."
          : "Notification emails have been turned off.",
      });
    } catch {
      toast({ title: "Error", description: "Failed to update notifications.", variant: "destructive" });
    }
  };

  const handleTestNotification = async () => {
    try {
      // Save current settings first
      await saveNotif.mutateAsync({ enabled: true, email: notifEmail, daysBefore: notifDays, sendTime: notifTime });
      const result = await sendTest.mutateAsync();
      if (result.success) {
        toast({ title: "Test sent!", description: result.message });
        qc.invalidateQueries({ queryKey: ["notification-settings"] });
      } else {
        toast({ title: "Not sent", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send test notification.", variant: "destructive" });
    }
  };

  return (
    <PageShell title="Settings" subtitle="Manage your firm and account preferences">
      <div className="max-w-xl space-y-6">

        {/* Firm Details */}
        <Section title="Firm Details" subtitle="Your firm information used in emails and the sidebar">
          <Field label="Firm Name">
            <Input value={firm} onChange={e => setFirm(e.target.value)} placeholder="e.g. Smith & Partners Accountants" className="bg-background" />
          </Field>
          <Field label="Accountant Name">
            <Input value={accountant} onChange={e => setAccountant(e.target.value)} placeholder="e.g. John Smith" className="bg-background" />
          </Field>
          <Field label="Email Address">
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. john@smithpartners.co.uk" className="bg-background" />
          </Field>
          <Field label="Phone Number">
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 020 7946 0000" className="bg-background" />
          </Field>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6">
            Save Details
          </Button>
        </Section>

        {/* Notifications */}
        <div className="bg-card border border-border/60 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Deadline Notifications
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Daily email digest sent to your phone before deadlines</p>
            </div>
            <button
              onClick={() => handleToggleEnabled(!notifEnabled)}
              disabled={saveNotif.isPending || notifLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                notifEnabled ? "bg-primary" : "bg-muted-foreground/30"
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  notifEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className={`px-6 py-5 space-y-4 ${!notifEnabled ? "opacity-60 pointer-events-none" : ""}`}>
            <Field label="Notification Email" hint="Where to send the daily digest — use your mobile email address">
              <Input
                type="email"
                value={notifEmail}
                onChange={e => setNotifEmail(e.target.value)}
                placeholder="e.g. yourname@gmail.com"
                className="bg-background"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Notify when due within" hint="Days before deadline">
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={notifDays}
                    onChange={e => setNotifDays(Number(e.target.value))}
                    className="bg-background pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">days</span>
                </div>
              </Field>
              <Field label="Send time" hint="Daily email at this time (UK time)">
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    type="time"
                    value={notifTime}
                    onChange={e => setNotifTime(e.target.value)}
                    className="bg-background pl-9"
                  />
                </div>
              </Field>
            </div>

            {/* Info box */}
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200/60 rounded-md px-4 py-3 text-xs text-blue-700">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <p>
                One email per day, sent at the time you choose. It lists all deadlines due within {notifDays} day{notifDays !== 1 ? "s" : ""} plus any overdue ones.
                Enable push notifications in your phone's email app to get it as a mobile alert.
              </p>
            </div>

            {notifSettings?.lastSentDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Last sent: {new Date(notifSettings.lastSentDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleSaveNotifications}
                disabled={saveNotif.isPending || !notifEmail}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5"
              >
                {saveNotif.isPending ? "Saving…" : "Save Notifications"}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestNotification}
                disabled={sendTest.isPending || !notifEmail}
                className="px-5"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {sendTest.isPending ? "Sending…" : "Send Test Now"}
              </Button>
            </div>
          </div>

          {!notifEnabled && (
            <div className="px-6 pb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <BellOff className="w-3.5 h-3.5" />
              Enable notifications with the toggle above, then configure your email and send time.
            </div>
          )}
        </div>

        {/* Password */}
        <Section title="Change Password" subtitle="Update your login password">
          <Field label="Current Password">
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                placeholder="Enter current password"
                className="bg-background pr-10"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="New Password">
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Minimum 6 characters"
                className="bg-background pr-10"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm New Password">
            <Input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Repeat new password"
              className="bg-background"
            />
          </Field>
          <Button
            onClick={handleChangePassword}
            disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
            variant="outline"
            className="px-6"
          >
            {pwdLoading ? "Updating…" : "Change Password"}
          </Button>
        </Section>

        {/* About */}
        <Section title="About">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><span className="text-foreground font-medium">Application:</span> Accounting Deadline Manager</p>
            <p><span className="text-foreground font-medium">Data source:</span> Companies House API</p>
            <p><span className="text-foreground font-medium">Storage:</span> PostgreSQL database</p>
            <p><span className="text-foreground font-medium">Version:</span> 1.1.0</p>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}

function Section({
  title, subtitle, children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-lg shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide block">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground -mt-0.5 mb-1">{hint}</p>}
      {children}
    </div>
  );
}
