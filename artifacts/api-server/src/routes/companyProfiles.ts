import { Router, type IRouter } from "express";
import pg from "pg";
import { logActivity } from "../lib/dataStore.js";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

pool.query(`
  CREATE TABLE IF NOT EXISTS company_profiles (
    company_number        VARCHAR(20) PRIMARY KEY,
    registered_name       VARCHAR(255),
    registered_address    TEXT,
    sic_code              VARCHAR(20),
    incorporation_date    DATE,
    ch_email              VARCHAR(255),
    ch_password           TEXT,
    auth_code             VARCHAR(20),
    confirmation_stmt_due DATE,

    utr                   VARCHAR(20),
    gateway_user_id       VARCHAR(100),
    gateway_password      TEXT,
    ct_reference          VARCHAR(30),
    vat_number            VARCHAR(30),
    vat_period            VARCHAR(50),
    vat_scheme            VARCHAR(50),
    paye_reference        VARCHAR(30),
    accounts_office_ref   VARCHAR(30),
    sa_utr                VARCHAR(20),

    share_code            VARCHAR(30),
    nino                  VARCHAR(20),
    passport_number       VARCHAR(30),
    passport_expiry       DATE,
    date_of_birth         DATE,

    bank_name             VARCHAR(100),
    sort_code             VARCHAR(10),
    account_number        VARCHAR(20),

    year_end_date         DATE,
    accounting_software   VARCHAR(100),
    bookkeeper_name       VARCHAR(100),
    bookkeeper_contact    VARCHAR(100),
    previous_accountant   VARCHAR(100),
    onboarding_date       DATE,
    engagement_letter_signed DATE,
    fee_amount            NUMERIC(10,2),
    billing_frequency     VARCHAR(50),
    aml_check_date        DATE,
    aml_status            VARCHAR(50),
    notes                 TEXT,

    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(console.error);

const ALWAYS_HIDDEN = ["ch_password", "gateway_password"];

const ALL_FIELDS = [
  "registered_name", "registered_address", "sic_code", "incorporation_date",
  "ch_email", "ch_password", "auth_code", "confirmation_stmt_due",
  "utr", "gateway_user_id", "gateway_password", "ct_reference",
  "vat_number", "vat_period", "vat_scheme", "paye_reference",
  "accounts_office_ref", "sa_utr", "share_code", "nino",
  "passport_number", "passport_expiry", "date_of_birth",
  "bank_name", "sort_code", "account_number", "year_end_date",
  "accounting_software", "bookkeeper_name", "bookkeeper_contact",
  "previous_accountant", "onboarding_date", "engagement_letter_signed",
  "fee_amount", "billing_frequency", "aml_check_date", "aml_status", "notes",
];

function rowToProfile(row: Record<string, unknown>, includeSensitive: boolean) {
  const profile: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (ALWAYS_HIDDEN.includes(key) && !includeSensitive) continue;
    if (value instanceof Date) {
      profile[key] = value.toISOString().slice(0, 10);
    } else {
      profile[key] = value;
    }
  }
  return profile;
}

const router: IRouter = Router();

router.get("/company-profiles/:company_number", async (req, res) => {
  const { company_number } = req.params;
  const includeSensitive = req.query.include_sensitive === "true";

  try {
    const { rows } = await pool.query(
      `SELECT * FROM company_profiles WHERE company_number = $1`,
      [company_number]
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({ profile: rowToProfile(rows[0] as Record<string, unknown>, includeSensitive) });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/company-profiles/:company_number", async (req, res) => {
  const { company_number } = req.params;
  const body = req.body as Record<string, unknown>;

  const values = [
    company_number,
    ...ALL_FIELDS.map((f) => {
      const v = body[f];
      return v === "" ? null : (v ?? null);
    }),
  ];

  const colList = ALL_FIELDS.join(", ");
  const insertPlaceholders = ALL_FIELDS.map((_, i) => `$${i + 2}`).join(", ");
  const updateClauses = ALL_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ");

  try {
    await pool.query(
      `INSERT INTO company_profiles (company_number, ${colList})
       VALUES ($1, ${insertPlaceholders})
       ON CONFLICT (company_number)
       DO UPDATE SET ${updateClauses}, updated_at = NOW()`,
      values
    );

    await logActivity(
      "profile_updated",
      "company",
      typeof body.registered_name === "string" ? body.registered_name : company_number,
      `Profile saved for ${company_number}`
    );

    const { rows } = await pool.query(
      `SELECT * FROM company_profiles WHERE company_number = $1`,
      [company_number]
    );
    res.json({ profile: rowToProfile(rows[0] as Record<string, unknown>, false) });
  } catch (err) {
    console.error("Profile upsert error:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

router.delete("/company-profiles/:company_number", async (req, res) => {
  const { company_number } = req.params;
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM company_profiles WHERE company_number = $1`,
      [company_number]
    );
    if (!rowCount) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Profile delete error:", err);
    res.status(500).json({ error: "Failed to delete profile" });
  }
});

export default router;
