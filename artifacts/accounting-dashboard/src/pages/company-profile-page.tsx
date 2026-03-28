import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Pencil, Save, X, Eye, EyeOff, Copy, Loader2,
  Building2, ShieldCheck, CreditCard, Briefcase, StickyNote,
  LandmarkIcon, FileText, ChevronRight, AlertTriangle, CheckCircle2, Clock, ExternalLink,
} from "lucide-react";
import { customFetch, useListClients } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { useToast } from "@/hooks/use-toast";
import { getComputedStatus, getDaysLeft } from "@/lib/client-utils";
import { format } from "date-fns";

type Profile = Record<string, string | null>;

const LOCALLY_SENSITIVE = new Set([
  "auth_code", "utr", "gateway_user_id", "sa_utr",
  "nino", "share_code", "passport_number",
  "sort_code", "account_number",
]);
const API_SENSITIVE = new Set(["ch_password", "gateway_password"]);

const SELECT_OPTIONS: Record<string, string[]> = {
  vat_scheme: ["Standard", "Flat Rate", "Cash Accounting", "Exempt", "Not Registered"],
  billing_frequency: ["Monthly", "Quarterly", "Annually", "One-off"],
  aml_status: ["Pending", "Verified", "Expired", "Not Started"],
  accounting_software: ["Xero", "QuickBooks", "Sage", "FreeAgent", "Other", "None"],
};

const DATE_FIELDS = new Set([
  "incorporation_date", "confirmation_stmt_due", "passport_expiry",
  "date_of_birth", "year_end_date", "onboarding_date",
  "engagement_letter_signed", "aml_check_date",
]);

// ── Shared context passed to field components ────────────────────────────────

interface ViewCtx {
  profile: Profile | null;
  revealed: Set<string>;
  sensitiveData: Record<string, string>;
  revealing: string | null;
  onReveal: (field: string) => void;
  onCopy: (field: string, label: string) => void;
}

interface EditCtx {
  form: Profile;
  onChange: (field: string, value: string) => void;
}

// ── Top-level field components (stable references, no remount on parent render) ─

function ViewField({
  ctx,
  label,
  field,
  textarea = false,
}: {
  ctx: ViewCtx;
  label: string;
  field: string;
  textarea?: boolean;
}) {
  const { profile, revealed, sensitiveData, revealing, onReveal, onCopy } = ctx;
  const isApiSens = API_SENSITIVE.has(field);
  const isLocalSens = LOCALLY_SENSITIVE.has(field);
  const isSens = isApiSens || isLocalSens;
  const isRevealed = revealed.has(field);
  const isRevealingThis = revealing === field;

  let rawValue: string | null = null;
  if (isApiSens) {
    rawValue = sensitiveData[field] ?? null;
  } else {
    rawValue = profile?.[field] ?? null;
  }

  let display = "—";
  if (rawValue) {
    if (isSens && !isRevealed) {
      display = "•••••••";
    } else if (DATE_FIELDS.has(field)) {
      try { display = format(new Date(rawValue), "dd MMM yyyy"); } catch { display = rawValue; }
    } else {
      display = rawValue;
    }
  }

  const isEmpty = !rawValue;
  const isMasked = isSens && !isRevealed && !isEmpty;

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div
        className={`flex items-${textarea ? "start" : "center"} gap-1.5 ${
          textarea ? "min-h-[72px] py-2" : "h-9"
        } px-3 rounded-lg bg-muted/20 border border-border/40`}
      >
        <span
          className={`flex-1 text-sm ${isMasked ? "font-mono tracking-[0.3em]" : ""} ${
            isEmpty ? "text-muted-foreground/40 italic" : "text-foreground"
          } ${textarea ? "self-start pt-0.5 whitespace-pre-wrap break-words" : "truncate"}`}
        >
          {display}
        </span>

        {isSens && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onReveal(field)}
                disabled={isRevealingThis}
                className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {isRevealingThis ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isRevealed ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Click to {isRevealed ? "hide" : "reveal"}</TooltipContent>
          </Tooltip>
        )}

        {!isEmpty && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onCopy(field, label)}
                className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function EditField({
  ctx,
  label,
  field,
  placeholder = "",
  textarea = false,
  type = "text",
}: {
  ctx: EditCtx;
  label: string;
  field: string;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
}) {
  const { form, onChange } = ctx;
  const opts = SELECT_OPTIONS[field];

  if (opts) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <Select
          value={form[field] ?? "__none__"}
          onValueChange={(v) => onChange(field, v === "__none__" ? "" : v)}
        >
          <SelectTrigger className="h-9 rounded-lg bg-background border-border text-sm">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {opts.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {textarea ? (
        <Textarea
          rows={3}
          placeholder={placeholder}
          value={form[field] ?? ""}
          onChange={(e) => onChange(field, e.target.value)}
          className="rounded-lg bg-background border-border text-sm resize-none"
        />
      ) : (
        <Input
          type={type}
          placeholder={placeholder}
          value={form[field] ?? ""}
          onChange={(e) => onChange(field, e.target.value)}
          className="h-9 rounded-lg bg-background border-border text-sm"
        />
      )}
    </div>
  );
}

function ProfileSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function statusBadgeCls(status: string) {
  const map: Record<string, string> = {
    overdue: "bg-destructive/15 text-destructive",
    due_soon: "bg-orange-500/15 text-orange-600",
    completed: "bg-emerald-500/15 text-emerald-600",
    pending: "bg-blue-500/15 text-blue-600",
  };
  return map[status] ?? map.pending;
}

// ── Main page component ───────────────────────────────────────────────────────

export default function CompanyProfilePage() {
  const params = useParams<{ company_number: string }>();
  const companyNumber = decodeURIComponent(params.company_number ?? "");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: allClients = [] } = useListClients();
  const companyClients = allClients.filter((c) => c.companyNumber === companyNumber);
  const companyName = companyClients[0]?.companyName ?? companyClients[0]?.clientName ?? companyNumber;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Profile>({});
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [sensitiveData, setSensitiveData] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customFetch<{ profile: Profile }>(
        `/api/company-profiles/${companyNumber}`
      );
      setProfile(data.profile);
      setForm(data.profile);
      setIsNew(false);
    } catch (err: any) {
      if (err?.status === 404) {
        setIsNew(true);
        setProfile(null);
      } else {
        toast({ title: "Error", description: "Could not load profile.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [companyNumber]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const createNew = async () => {
    setCreatingNew(true);
    const prefill: Profile = { registered_name: companyName };
    try {
      const chData = await customFetch<any>(`/api/company/${companyNumber}`);
      if (chData?.companyName) prefill.registered_name = chData.companyName;
      if (chData?.incorporatedOn) prefill.incorporation_date = chData.incorporatedOn;
      if (chData?.confirmationStatementDueDate)
        prefill.confirmation_stmt_due = chData.confirmationStatementDueDate;
      if (chData?.registeredAddress) prefill.registered_address = chData.registeredAddress;
      if (chData?.sicCodes) prefill.sic_code = chData.sicCodes;
    } catch {}

    try {
      const data = await customFetch<{ profile: Profile }>(
        `/api/company-profiles/${companyNumber}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefill),
        }
      );
      setProfile(data.profile);
      setForm(data.profile);
      setIsNew(false);
      setEditing(true);
      toast({ title: "Profile created", description: "Fill in the details below." });
    } catch {
      toast({ title: "Error", description: "Could not create profile.", variant: "destructive" });
    } finally {
      setCreatingNew(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const data = await customFetch<{ profile: Profile }>(
        `/api/company-profiles/${companyNumber}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      setProfile(data.profile);
      setForm(data.profile);
      setEditing(false);
      setSensitiveData({});
      setRevealed(new Set());
      toast({ title: "Saved", description: "Company profile updated." });
    } catch {
      toast({ title: "Save failed", description: "Could not save profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm(profile ?? {});
    setEditing(false);
  };

  const revealField = useCallback(async (field: string) => {
    if (API_SENSITIVE.has(field) && !sensitiveData[field]) {
      setRevealing(field);
      try {
        const data = await customFetch<{ profile: Profile }>(
          `/api/company-profiles/${companyNumber}?include_sensitive=true`
        );
        const next: Record<string, string> = {};
        if (data.profile.ch_password) next.ch_password = data.profile.ch_password;
        if (data.profile.gateway_password) next.gateway_password = data.profile.gateway_password;
        setSensitiveData((prev) => ({ ...prev, ...next }));
        setRevealed((prev) => new Set([...prev, field]));
      } catch {
        toast({ title: "Error", description: "Could not reveal value.", variant: "destructive" });
      } finally {
        setRevealing(null);
      }
    } else {
      setRevealed((prev) => {
        const next = new Set(prev);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return next;
      });
    }
  }, [companyNumber, sensitiveData]);

  const copyField = useCallback((field: string, label: string) => {
    const value = API_SENSITIVE.has(field)
      ? sensitiveData[field]
      : profile?.[field] ?? null;
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    });
  }, [profile, sensitiveData]);

  const handleChange = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  }, []);

  const viewCtx: ViewCtx = { profile, revealed, sensitiveData, revealing, onReveal: revealField, onCopy: copyField };
  const editCtx: EditCtx = { form, onChange: handleChange };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  // ── No profile yet ────────────────────────────────────────────────────────

  if (isNew) {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-y-auto">
          <header className="flex-shrink-0 bg-primary border-b border-white/10 px-8 py-5">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <Button
                variant="ghost" size="icon"
                onClick={() => navigate("/clients")}
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-0.5">Company Profile</p>
                <h1 className="text-xl font-bold text-white leading-none">{companyName}</h1>
              </div>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">No reference profile yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Create a profile to store all key credentials, references, banking and billing
                details in one secure place — with masked fields and one-click copy.
              </p>
              <Button
                onClick={createNew}
                disabled={creatingNew}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-6"
              >
                {creatingNew ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}
                {creatingNew ? "Creating..." : "Create Profile"}
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Main profile view ─────────────────────────────────────────────────────

  const F = editing ? EditField : ViewField;
  const ctx = editing ? editCtx : viewCtx;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Header */}
        <header className="flex-shrink-0 bg-primary border-b border-white/10 px-8 py-5">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost" size="icon"
                onClick={() => navigate("/clients")}
                className="h-8 w-8 flex-shrink-0 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-0.5">Company Reference Profile</p>
                <h1 className="text-xl font-bold text-white leading-none truncate">
                  {profile?.registered_name ?? companyName}
                </h1>
                <p className="text-white/50 text-xs font-mono mt-0.5">{companyNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {editing ? (
                <>
                  <Button variant="ghost" onClick={cancelEdit} className="rounded-xl text-white/70 hover:text-white hover:bg-white/10">
                    <X className="w-4 h-4 mr-1.5" /> Cancel
                  </Button>
                  <Button onClick={saveProfile} disabled={saving} className="rounded-xl bg-white text-primary hover:bg-white/90 font-semibold">
                    {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)} className="rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20">
                  <Pencil className="w-4 h-4 mr-1.5" /> Edit
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto space-y-4">

            {/* Companies House */}
            <ProfileSection icon={Building2} title="Companies House">
              <F ctx={ctx as any} label="Registered Name" field="registered_name" />
              <F ctx={ctx as any} label="SIC Code" field="sic_code" placeholder="e.g. 62020" />
              <F ctx={ctx as any} label="Incorporation Date" field="incorporation_date" type="date" />
              <F ctx={ctx as any} label="Confirmation Statement Due" field="confirmation_stmt_due" type="date" />
              <div className="sm:col-span-2">
                <F ctx={ctx as any} label="Registered Address" field="registered_address" textarea placeholder="Full registered address" />
              </div>
              <F ctx={ctx as any} label="CH Login Email" field="ch_email" type="email" placeholder="login@example.com" />
              <F ctx={ctx as any} label="CH Login Password" field="ch_password" placeholder="••••••••" />
              <F ctx={ctx as any} label="Authentication Code" field="auth_code" placeholder="6-character code" />
            </ProfileSection>

            {/* HMRC */}
            <ProfileSection icon={LandmarkIcon} title="HMRC">
              <F ctx={ctx as any} label="UTR (Unique Taxpayer Reference)" field="utr" placeholder="10-digit UTR" />
              <F ctx={ctx as any} label="Corporation Tax Reference" field="ct_reference" placeholder="CT reference" />
              <F ctx={ctx as any} label="Government Gateway User ID" field="gateway_user_id" placeholder="12-digit ID" />
              <F ctx={ctx as any} label="Government Gateway Password" field="gateway_password" placeholder="••••••••" />
              <F ctx={ctx as any} label="VAT Number" field="vat_number" placeholder="GB 123456789" />
              <F ctx={ctx as any} label="VAT Return Period" field="vat_period" placeholder="e.g. Quarterly" />
              <F ctx={ctx as any} label="VAT Scheme" field="vat_scheme" />
              <F ctx={ctx as any} label="PAYE Employer Reference" field="paye_reference" placeholder="e.g. 123/AB456" />
              <F ctx={ctx as any} label="Accounts Office Reference" field="accounts_office_ref" placeholder="18-character ref" />
              <F ctx={ctx as any} label="Self Assessment UTR" field="sa_utr" placeholder="SA UTR (director)" />
            </ProfileSection>

            {/* Identity & Verification */}
            <ProfileSection icon={ShieldCheck} title="Identity & Verification">
              <F ctx={ctx as any} label="National Insurance Number" field="nino" placeholder="AB 12 34 56 C" />
              <F ctx={ctx as any} label="Share Code (Right to Work)" field="share_code" placeholder="9-character code" />
              <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 text-xs text-blue-700">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                <span>Share codes are 9 characters (e.g. W4B3FKVB6). To verify a share code with the Home Office:</span>
                <a
                  href="https://www.gov.uk/view-right-to-work"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 underline decoration-dotted underline-offset-2 flex-shrink-0"
                >
                  gov.uk verify <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <F ctx={ctx as any} label="Passport Number" field="passport_number" placeholder="Passport number" />
              <F ctx={ctx as any} label="Passport Expiry" field="passport_expiry" type="date" />
              <F ctx={ctx as any} label="Date of Birth" field="date_of_birth" type="date" />
            </ProfileSection>

            {/* Banking */}
            <ProfileSection icon={CreditCard} title="Banking">
              <F ctx={ctx as any} label="Bank Name" field="bank_name" placeholder="e.g. Barclays" />
              <F ctx={ctx as any} label="Sort Code" field="sort_code" placeholder="00-00-00" />
              <F ctx={ctx as any} label="Account Number" field="account_number" placeholder="8-digit number" />
            </ProfileSection>

            {/* Engagement & Billing */}
            <ProfileSection icon={Briefcase} title="Engagement & Billing">
              <F ctx={ctx as any} label="Year End Date" field="year_end_date" type="date" />
              <F ctx={ctx as any} label="Accounting Software" field="accounting_software" />
              <F ctx={ctx as any} label="Bookkeeper Name" field="bookkeeper_name" placeholder="Name" />
              <F ctx={ctx as any} label="Bookkeeper Contact" field="bookkeeper_contact" placeholder="Phone / email" />
              <F ctx={ctx as any} label="Previous Accountant" field="previous_accountant" placeholder="Firm name" />
              <F ctx={ctx as any} label="Onboarding Date" field="onboarding_date" type="date" />
              <F ctx={ctx as any} label="Engagement Letter Signed" field="engagement_letter_signed" type="date" />
              <F ctx={ctx as any} label="Fee Amount (£)" field="fee_amount" type="number" placeholder="0.00" />
              <F ctx={ctx as any} label="Billing Frequency" field="billing_frequency" />
              <F ctx={ctx as any} label="AML Check Date" field="aml_check_date" type="date" />
              <F ctx={ctx as any} label="AML Status" field="aml_status" />
            </ProfileSection>

            {/* Notes */}
            <ProfileSection icon={StickyNote} title="Notes">
              <div className="sm:col-span-2">
                <F ctx={ctx as any} label="Internal Notes" field="notes" textarea placeholder="Any additional notes about this client..." />
              </div>
            </ProfileSection>

            {/* Linked Deadlines */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <FileText className="w-4 h-4 text-primary" />
                  Linked Deadlines
                  <Badge variant="secondary" className="ml-auto text-xs">{companyClients.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {companyClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No deadlines linked to this company.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/40">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/40">
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Days Left</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {companyClients.map((c) => {
                          const status = getComputedStatus(c);
                          const days = getDaysLeft(c.dueDate);
                          return (
                            <tr key={c.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-foreground">{c.deadlineType}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {format(new Date(c.dueDate), "dd MMM yyyy")}
                              </td>
                              <td className="px-4 py-2.5">
                                {c.status === "completed" ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <span className={`font-semibold ${days < 0 ? "text-destructive" : days <= 14 ? "text-orange-500" : "text-foreground"}`}>
                                    {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge className={`${statusBadgeCls(status)} border-0 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-none capitalize`}>
                                  {status === "overdue" && <AlertTriangle className="w-3 h-3 mr-1" />}
                                  {status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                  {(status === "due_soon" || status === "pending") && <Clock className="w-3 h-3 mr-1" />}
                                  {status.replace("_", " ")}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => navigate("/clients")}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}
