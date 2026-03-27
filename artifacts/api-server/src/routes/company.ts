import { Router, type IRouter } from "express";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

// Ensure directors table exists and has email column
pool.query(`
  CREATE TABLE IF NOT EXISTS directors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_number VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    phone VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(company_number, name)
  )
`).then(() =>
  pool.query(`ALTER TABLE directors ADD COLUMN IF NOT EXISTS email VARCHAR`)
).catch(console.error);

// Ensure company_files table exists
pool.query(`
  CREATE TABLE IF NOT EXISTS company_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_number VARCHAR NOT NULL,
    file_name VARCHAR NOT NULL,
    category VARCHAR NOT NULL DEFAULT 'document',
    content_type VARCHAR NOT NULL,
    object_path VARCHAR NOT NULL,
    description VARCHAR,
    uploaded_at TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

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

async function fetchDirectorsFromCH(number: string, auth: string) {
  const res = await fetch(
    `${CH_BASE}/company/${number}/officers?items_per_page=50`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{
      name: string;
      officer_role: string;
      resigned_on?: string;
      appointed_on?: string;
    }>;
  };
  return (data.items ?? [])
    .filter(
      (o) =>
        (o.officer_role === "director" || o.officer_role === "corporate-director") &&
        !o.resigned_on
    )
    .slice(0, 5)
    .map((o) => ({ name: o.name, appointedOn: o.appointed_on ?? null }));
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

// GET /api/company/:number/directors
// Returns CH active directors merged with stored phone numbers
router.get("/company/:number/directors", async (req, res) => {
  const { number } = req.params;
  const apiKey = getApiKey();
  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  try {
    const [chDirectors, { rows: stored }] = await Promise.all([
      fetchDirectorsFromCH(number, auth),
      pool.query(
        `SELECT name, phone, email FROM directors WHERE company_number = $1`,
        [number]
      ),
    ]);

    const phoneMap = new Map<string, string | null>(
      stored.map((r: any) => [r.name, r.phone ?? null])
    );
    const emailMap = new Map<string, string | null>(
      stored.map((r: any) => [r.name, r.email ?? null])
    );

    const directors = chDirectors.map((d) => ({
      name: d.name,
      appointedOn: d.appointedOn,
      phone: phoneMap.get(d.name) ?? null,
      email: emailMap.get(d.name) ?? null,
    }));

    res.json({ directors });
  } catch (err) {
    console.error("Directors fetch error:", err);
    res.status(500).json({ error: "Failed to fetch directors" });
  }
});

// PUT /api/company/:number/directors
// Body: { directors: [{ name, phone, email }] }
router.put("/company/:number/directors", async (req, res) => {
  const { number } = req.params;
  const { directors } = req.body as {
    directors: Array<{ name: string; phone: string | null; email: string | null }>;
  };

  if (!Array.isArray(directors)) {
    res.status(400).json({ error: "directors must be an array" });
    return;
  }

  try {
    await Promise.all(
      directors.map((d) =>
        pool.query(
          `INSERT INTO directors (company_number, name, phone, email)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (company_number, name)
           DO UPDATE SET phone = $3, email = $4, updated_at = NOW()`,
          [number, d.name, d.phone ?? null, d.email ?? null]
        )
      )
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Directors save error:", err);
    res.status(500).json({ error: "Failed to save directors" });
  }
});

// GET /api/company/:number/files
router.get("/company/:number/files", async (req, res) => {
  const { number } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, file_name, category, content_type, object_path, description, uploaded_at
       FROM company_files WHERE company_number = $1 ORDER BY uploaded_at DESC`,
      [number]
    );
    res.json({ files: rows });
  } catch (err) {
    console.error("Files fetch error:", err);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// POST /api/company/:number/files
router.post("/company/:number/files", async (req, res) => {
  const { number } = req.params;
  const { fileName, category, contentType, objectPath, description } = req.body as {
    fileName: string;
    category: string;
    contentType: string;
    objectPath: string;
    description?: string;
  };

  if (!fileName || !category || !contentType || !objectPath) {
    res.status(400).json({ error: "fileName, category, contentType, objectPath are required" });
    return;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO company_files (company_number, file_name, category, content_type, object_path, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, file_name, category, content_type, object_path, description, uploaded_at`,
      [number, fileName, category, contentType, objectPath, description ?? null]
    );
    res.status(201).json({ file: rows[0] });
  } catch (err) {
    console.error("File register error:", err);
    res.status(500).json({ error: "Failed to register file" });
  }
});

// DELETE /api/company/:number/files/:id
router.delete("/company/:number/files/:id", async (req, res) => {
  const { number, id } = req.params;
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM company_files WHERE id = $1 AND company_number = $2`,
      [id, number]
    );
    if (!rowCount) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("File delete error:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
