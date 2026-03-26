import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CH_BASE = "https://api.company-information.service.gov.uk";

function getApiKey(): string {
  const key = process.env["CH_API_KEY"];
  if (!key) throw new Error("CH_API_KEY environment variable is not set");
  return key;
}

function formatDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  return dateStr;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

router.get("/company/:number", async (req, res) => {
  const { number } = req.params;
  const apiKey = getApiKey();
  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  try {
    const [profileRes, filingRes] = await Promise.all([
      fetch(`${CH_BASE}/company/${number}`, {
        headers: { Authorization: `Basic ${auth}` },
      }),
      fetch(`${CH_BASE}/company/${number}/filing-history?items_per_page=5`, {
        headers: { Authorization: `Basic ${auth}` },
      }),
    ]);

    if (!profileRes.ok) {
      if (profileRes.status === 404) {
        res.status(404).json({ error: "Company not found" });
        return;
      }
      res.status(profileRes.status).json({ error: "Companies House API error" });
      return;
    }

    const profile = (await profileRes.json()) as {
      company_number: string;
      company_name: string;
      company_status: string;
      date_of_creation?: string;
      accounts?: {
        next_due?: string;
        next_accounts?: { due_on?: string };
      };
      confirmation_statement?: {
        next_due?: string;
        next_made_up_to?: string;
      };
      annual_return?: { next_due?: string };
    };

    let accountsDue: string | null = null;
    let confirmationDue: string | null = null;

    if (profile.accounts?.next_due) {
      accountsDue = formatDate(profile.accounts.next_due);
    } else if (profile.accounts?.next_accounts?.due_on) {
      accountsDue = formatDate(profile.accounts.next_accounts.due_on);
    }

    if (profile.confirmation_statement?.next_due) {
      confirmationDue = formatDate(profile.confirmation_statement.next_due);
    }

    const incorporatedOn = profile.date_of_creation
      ? formatDate(profile.date_of_creation)
      : null;

    let vatDue: string | null = null;
    let selfAssessmentDue: string | null = null;

    if (incorporatedOn) {
      vatDue = addMonths(incorporatedOn, 3);
      selfAssessmentDue = addMonths(new Date().getFullYear() + "-01-31", 0);
    }

    res.json({
      companyNumber: profile.company_number,
      companyName: profile.company_name,
      companyStatus: profile.company_status || "unknown",
      incorporatedOn,
      accountsDueDate: accountsDue,
      confirmationStatementDueDate: confirmationDue,
      vatReturnDueDate: vatDue,
      selfAssessmentDueDate: selfAssessmentDue,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch from Companies House");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
