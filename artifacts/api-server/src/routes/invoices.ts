import { Router, type IRouter, type Request, type Response } from "express";
import pg from "pg";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { getLogoAttachment, buildEmailHtml } from "../lib/emailTemplate.js";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

const router: IRouter = Router();

// ─── DB bootstrap ────────────────────────────────────────────────────────────

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR NOT NULL UNIQUE,
      company_number VARCHAR,
      client_name VARCHAR NOT NULL,
      client_email VARCHAR NOT NULL,
      client_address TEXT,
      issue_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      description VARCHAR NOT NULL,
      quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL,
      vat_rate DECIMAL(5,2) NOT NULL DEFAULT 20
    );
  `);
}

ensureTables().catch(console.error);

// ─── Next invoice number ──────────────────────────────────────────────────────

async function nextInvoiceNumber(): Promise<string> {
  const { rows } = await pool.query(
    `SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1`
  );
  if (!rows.length) return "INV-001";
  const last = rows[0].invoice_number as string;
  const match = last.match(/(\d+)$/);
  const n = match ? parseInt(match[1], 10) + 1 : 1;
  return `INV-${String(n).padStart(3, "0")}`;
}

// ─── PDF builder ─────────────────────────────────────────────────────────────

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

interface InvoiceData {
  invoice_number: string;
  client_name: string;
  client_email: string;
  client_address?: string | null;
  issue_date: string;
  due_date: string;
  notes?: string | null;
  items: InvoiceItem[];
}

function buildPdf(data: InvoiceData): Buffer {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));

  const NAVY = "#0f172a";
  const RED = "#dc2626";
  const GREY = "#64748b";
  const LIGHT = "#f1f5f9";
  const pageW = doc.page.width - 100; // usable width (margins 50 each side)

  // ── Header band ──────────────────────────────────────────────────────────
  doc.rect(50, 50, pageW, 90).fill(NAVY);

  doc
    .fillColor("#ffffff")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("INVOICE", 70, 68);

  doc
    .fillColor("#94a3b8")
    .fontSize(9)
    .font("Helvetica")
    .text("Manda London Ltd", 70, 97)
    .text("Deadline Manager", 70, 110);

  // Invoice number + dates on right side of header
  doc
    .fillColor("#ffffff")
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(data.invoice_number, 380, 68, { width: 160, align: "right" });

  doc
    .fillColor("#94a3b8")
    .fontSize(8)
    .font("Helvetica")
    .text(`Issue date: ${fmtDate(data.issue_date)}`, 380, 84, { width: 160, align: "right" })
    .text(`Due date:   ${fmtDate(data.due_date)}`, 380, 97, { width: 160, align: "right" });

  // ── Bill to ──────────────────────────────────────────────────────────────
  doc.moveDown(0);
  const billY = 158;

  doc
    .fillColor(GREY)
    .fontSize(7)
    .font("Helvetica-Bold")
    .text("BILL TO", 50, billY);

  doc
    .fillColor(NAVY)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(data.client_name, 50, billY + 14);

  doc
    .fillColor(GREY)
    .fontSize(8)
    .font("Helvetica")
    .text(data.client_email, 50, billY + 28);

  if (data.client_address) {
    doc.text(data.client_address, 50, billY + 41, { width: 240 });
  }

  // ── Items table header ───────────────────────────────────────────────────
  const tableTop = 240;
  const cols = { desc: 50, qty: 280, price: 340, vat: 410, total: 460 };

  doc.rect(50, tableTop, pageW, 20).fill(NAVY);

  doc
    .fillColor("#ffffff")
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("DESCRIPTION", cols.desc + 4, tableTop + 6)
    .text("QTY", cols.qty, tableTop + 6, { width: 50, align: "right" })
    .text("UNIT PRICE", cols.price, tableTop + 6, { width: 60, align: "right" })
    .text("VAT %", cols.vat, tableTop + 6, { width: 40, align: "right" })
    .text("TOTAL", cols.total, tableTop + 6, { width: 80, align: "right" });

  // ── Items ────────────────────────────────────────────────────────────────
  let y = tableTop + 20;
  let subtotal = 0;
  let totalVat = 0;

  data.items.forEach((item, i) => {
    const lineNet = item.quantity * item.unit_price;
    const lineVat = lineNet * (item.vat_rate / 100);
    const lineTotal = lineNet + lineVat;
    subtotal += lineNet;
    totalVat += lineVat;

    const bg = i % 2 === 0 ? "#ffffff" : LIGHT;
    doc.rect(50, y, pageW, 22).fill(bg);

    doc
      .fillColor(NAVY)
      .fontSize(8)
      .font("Helvetica")
      .text(item.description, cols.desc + 4, y + 7, { width: 220 })
      .text(String(item.quantity), cols.qty, y + 7, { width: 50, align: "right" })
      .text(`£${item.unit_price.toFixed(2)}`, cols.price, y + 7, { width: 60, align: "right" })
      .text(`${item.vat_rate}%`, cols.vat, y + 7, { width: 40, align: "right" })
      .text(`£${lineTotal.toFixed(2)}`, cols.total, y + 7, { width: 80, align: "right" });

    y += 22;
  });

  // ── Totals block ─────────────────────────────────────────────────────────
  y += 10;
  const grand = subtotal + totalVat;

  const totRow = (label: string, value: string, bold = false, highlight = false) => {
    if (highlight) doc.rect(50, y, pageW, 22).fill(NAVY);
    doc
      .fillColor(highlight ? "#ffffff" : NAVY)
      .fontSize(9)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .text(label, 380, y + 7, { width: 60, align: "right" })
      .text(value, cols.total, y + 7, { width: 80, align: "right" });
    y += 22;
  };

  totRow("Subtotal:", `£${subtotal.toFixed(2)}`);
  totRow("VAT:", `£${totalVat.toFixed(2)}`);
  totRow("TOTAL DUE:", `£${grand.toFixed(2)}`, true, true);

  // ── Notes ────────────────────────────────────────────────────────────────
  if (data.notes) {
    y += 20;
    doc
      .fillColor(GREY)
      .fontSize(7)
      .font("Helvetica-Bold")
      .text("NOTES", 50, y);
    doc
      .fillColor(NAVY)
      .fontSize(8)
      .font("Helvetica")
      .text(data.notes, 50, y + 12, { width: pageW });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 60;
  doc.rect(50, footerY, pageW, 1).fill(RED);
  doc
    .fillColor(GREY)
    .fontSize(7)
    .font("Helvetica")
    .text("Thank you for your business — Manda London Ltd", 50, footerY + 8, {
      width: pageW,
      align: "center",
    });

  doc.end();
  return Buffer.concat(chunks);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── SMTP helper ─────────────────────────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/invoices
router.get("/invoices", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*,
        COALESCE(json_agg(ii ORDER BY ii.id) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      GROUP BY i.id
      ORDER BY i.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load invoices" });
  }
});

// POST /api/invoices
router.post("/invoices", async (req: Request, res: Response) => {
  const { company_number, client_name, client_email, client_address, issue_date, due_date, notes, items } = req.body as {
    company_number?: string;
    client_name: string;
    client_email: string;
    client_address?: string;
    issue_date: string;
    due_date: string;
    notes?: string;
    items: Array<{ description: string; quantity: number; unit_price: number; vat_rate: number }>;
  };

  if (!client_name || !client_email || !issue_date || !due_date || !items?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const invoice_number = await nextInvoiceNumber();

    const { rows } = await client.query(
      `INSERT INTO invoices (invoice_number, company_number, client_name, client_email, client_address, issue_date, due_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [invoice_number, company_number || null, client_name, client_email, client_address || null, issue_date, due_date, notes || null]
    );
    const invoice = rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate) VALUES ($1,$2,$3,$4,$5)`,
        [invoice.id, item.description, item.quantity, item.unit_price, item.vat_rate]
      );
    }

    await client.query("COMMIT");

    const itemRows = await pool.query(`SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id`, [invoice.id]);
    res.status(201).json({ ...invoice, items: itemRows.rows });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create invoice" });
  } finally {
    client.release();
  }
});

// PATCH /api/invoices/:id — update status or fields
router.patch("/invoices/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status: string };
  try {
    await pool.query(`UPDATE invoices SET status=$1, updated_at=NOW() WHERE id=$2`, [status, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update invoice" });
  }
});

// DELETE /api/invoices/:id
router.delete("/invoices/:id", async (req: Request, res: Response) => {
  try {
    await pool.query(`DELETE FROM invoices WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

// GET /api/invoices/:id/pdf — download PDF
router.get("/invoices/:id/pdf", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*,
        COALESCE(json_agg(ii ORDER BY ii.id) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.id = $1
      GROUP BY i.id
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const inv = rows[0];

    const pdf = buildPdf({
      invoice_number: inv.invoice_number,
      client_name: inv.client_name,
      client_email: inv.client_email,
      client_address: inv.client_address,
      issue_date: inv.issue_date.toISOString?.() ?? inv.issue_date,
      due_date: inv.due_date.toISOString?.() ?? inv.due_date,
      notes: inv.notes,
      items: inv.items,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${inv.invoice_number}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// POST /api/invoices/:id/send — email the PDF to the client
router.post("/invoices/:id/send", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*,
        COALESCE(json_agg(ii ORDER BY ii.id) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.id = $1
      GROUP BY i.id
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const inv = rows[0];

    const grand = (inv.items as InvoiceItem[]).reduce((sum: number, item: InvoiceItem) => {
      const net = item.quantity * item.unit_price;
      return sum + net + net * (item.vat_rate / 100);
    }, 0);

    const pdf = buildPdf({
      invoice_number: inv.invoice_number,
      client_name: inv.client_name,
      client_email: inv.client_email,
      client_address: inv.client_address,
      issue_date: inv.issue_date.toISOString?.() ?? inv.issue_date,
      due_date: inv.due_date.toISOString?.() ?? inv.due_date,
      notes: inv.notes,
      items: inv.items,
    });

    const logoAttachment = await getLogoAttachment();
    const dueStr = fmtDate(inv.due_date.toISOString?.() ?? inv.due_date);
    const textBody = [
      `Dear ${inv.client_name},`,
      "",
      `Please find attached invoice ${inv.invoice_number} for £${grand.toFixed(2)} (inc. VAT).`,
      `Payment is due by ${dueStr}.`,
      inv.notes ? `\nNotes: ${inv.notes}` : "",
      "",
      "Thank you for your business.",
      "Manda London Ltd",
    ].filter((l) => l !== undefined).join("\n");

    const invoiceHtml = buildEmailHtml(`
      <p style="margin:0 0 16px;">Dear <strong>${inv.client_name}</strong>,</p>
      <p style="margin:0 0 16px;">Please find attached invoice <strong>${inv.invoice_number}</strong> for <strong>£${grand.toFixed(2)}</strong> (inc. VAT).</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;overflow:hidden;">
        <tr style="background:#0d1b3e;color:#fff;">
          <td style="padding:10px 16px;font-weight:700;">Invoice Number</td>
          <td style="padding:10px 16px;">${inv.invoice_number}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 16px;font-weight:700;color:#374151;">Amount Due</td>
          <td style="padding:10px 16px;color:#374151;font-weight:700;">£${grand.toFixed(2)} (inc. VAT)</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:700;color:#374151;">Payment Due</td>
          <td style="padding:10px 16px;color:#c0392b;font-weight:700;">${dueStr}</td>
        </tr>
      </table>
      ${inv.notes ? `<p style="margin:0 0 16px;color:#555;font-size:14px;"><strong>Notes:</strong> ${inv.notes}</p>` : ""}
      <p style="margin:0;">Thank you for your business. The invoice PDF is attached to this email.</p>
    `, !!logoAttachment);

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Manda London Ltd" <${process.env.SMTP_USER}>`,
      to: inv.client_email,
      subject: `Invoice ${inv.invoice_number} from Manda London Ltd — £${grand.toFixed(2)} due ${dueStr}`,
      text: textBody,
      html: invoiceHtml,
      attachments: [
        { filename: `${inv.invoice_number}.pdf`, content: pdf, contentType: "application/pdf" },
        ...(logoAttachment ? [logoAttachment] : []),
      ],
    });

    // Mark as sent
    await pool.query(`UPDATE invoices SET status='sent', updated_at=NOW() WHERE id=$1`, [inv.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send invoice" });
  }
});

export default router;
