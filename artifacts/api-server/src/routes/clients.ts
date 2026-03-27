import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
import {
  loadClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
  computeDaysLeft,
  autoUpdateStatuses,
  logActivity,
  type Client,
} from "../lib/dataStore.js";

const router: IRouter = Router();

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

router.get("/clients/export", async (_req, res) => {
  try {
    await autoUpdateStatuses();
    const clients = await loadClients();
    const rows = clients.map((c) => ({
      clientName: c.clientName,
      clientEmail: c.clientEmail ?? null,
      companyNumber: c.companyNumber,
      companyName: c.companyName,
      deadlineType: c.deadlineType,
      dueDate: c.dueDate,
      daysLeft: computeDaysLeft(c.dueDate),
      status: c.status,
      notes: c.notes ?? null,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to export clients" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    await autoUpdateStatuses();
    const clients = await loadClients();

    let overdue = 0;
    let dueSoon = 0;
    let upcoming = 0;
    let completed = 0;

    for (const c of clients) {
      if (c.status === "completed") { completed++; continue; }
      const days = computeDaysLeft(c.dueDate);
      if (days < 0) overdue++;
      else if (days <= 14) dueSoon++;
      else upcoming++;
    }

    const uniqueCompanies = new Set(clients.map((c) => c.companyNumber)).size;
    res.json({ total: uniqueCompanies, overdue, dueSoon, upcoming, completed });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/clients", async (_req, res) => {
  try {
    await autoUpdateStatuses();
    const clients = await loadClients();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: "Failed to load clients" });
  }
});

router.post("/clients", async (req, res) => {
  const body = req.body as {
    clientName: string;
    clientEmail?: string | null;
    companyNumber: string;
    companyName: string;
    deadlineType: string;
    dueDate: string;
    status: "pending" | "completed" | "overdue";
    notes?: string | null;
  };

  if (!body.clientName || !body.companyNumber || !body.companyName || !body.deadlineType || !body.dueDate || !body.status) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const client = await createClient({
      clientName: body.clientName,
      clientEmail: body.clientEmail ?? null,
      companyNumber: body.companyNumber,
      companyName: body.companyName,
      deadlineType: body.deadlineType,
      dueDate: body.dueDate,
      status: body.status,
      notes: body.notes ?? null,
    });
    await logActivity(
      "Client added",
      "client",
      `${body.clientName} — ${body.deadlineType}`,
      `Company: ${body.companyName} (${body.companyNumber}), Due: ${body.dueDate}`
    );
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: "Failed to create client" });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const client = await getClientById(req.params.id);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: "Failed to get client" });
  }
});

router.put("/clients/:id", async (req, res) => {
  const body = req.body as Partial<Omit<Client, "id" | "createdAt">>;
  try {
    const updated = await updateClient(req.params.id, body);
    if (!updated) { res.status(404).json({ error: "Client not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update client" });
  }
});

router.delete("/clients/:id", async (req, res) => {
  try {
    const existing = await getClientById(req.params.id);
    const ok = await deleteClient(req.params.id);
    if (!ok) { res.status(404).json({ error: "Client not found" }); return; }
    if (existing) {
      await logActivity(
        "Client deleted",
        "client",
        `${existing.clientName} — ${existing.deadlineType}`,
        `Company: ${existing.companyName}`
      );
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete client" });
  }
});

router.post("/clients/:id/complete", async (req, res) => {
  try {
    const existing = await getClientById(req.params.id);
    const updated = await updateClient(req.params.id, { status: "completed" });
    if (!updated) { res.status(404).json({ error: "Client not found" }); return; }
    if (existing) {
      await logActivity(
        "Deadline completed",
        "deadline",
        `${existing.clientName} — ${existing.deadlineType}`,
        `Company: ${existing.companyName}, Due: ${existing.dueDate}`
      );
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to mark complete" });
  }
});

router.get("/clients/:id/email-preview", async (req, res) => {
  try {
    const client = await getClientById(req.params.id);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    const days = computeDaysLeft(client.dueDate);
    const formattedDue = new Date(client.dueDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let urgencyLine = "";
    if (days < 0) urgencyLine = `This deadline was ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago and is now overdue.`;
    else if (days === 0) urgencyLine = "This deadline is due TODAY.";
    else if (days <= 7) urgencyLine = `This deadline is due in ${days} day${days === 1 ? "" : "s"} — urgent action required.`;
    else if (days <= 14) urgencyLine = `This deadline is due in ${days} days — please act soon.`;
    else urgencyLine = `This deadline is due in ${days} days.`;

    const subject = `Reminder: ${client.deadlineType} deadline for ${client.companyName} — due ${formattedDue}`;
    const body = `Dear ${client.clientName},\n\nI hope this message finds you well.\n\nI am writing to remind you that the following deadline is approaching for ${client.companyName} (Company No. ${client.companyNumber}):\n\n  Deadline Type: ${client.deadlineType}\n  Due Date:      ${formattedDue}\n\n${urgencyLine}\n\nPlease ensure all required documents and information are ready in advance. Failure to file on time may result in penalties from HMRC or Companies House.\n\nIf you have any questions or require assistance, please do not hesitate to contact us.\n\nKind regards,\nYour Accounting Team`;

    res.json({ subject, body, clientName: client.clientName, clientEmail: client.clientEmail ?? null, dueDate: client.dueDate, deadlineType: client.deadlineType });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate email preview" });
  }
});

router.post("/clients/:id/send-email", async (req, res) => {
  try {
    const client = await getClientById(req.params.id);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    const { to, subject, body } = req.body as { to: string; subject: string; body: string };
    if (!to || !subject || !body) { res.status(400).json({ error: "Missing to, subject, or body" }); return; }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      res.status(500).json({ error: "Email credentials not configured on server." });
      return;
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Accounting Team"}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: body,
    });

    await logActivity(
      "Email sent",
      "email",
      `${client.clientName} — ${client.deadlineType}`,
      `To: ${to}, Subject: ${subject.substring(0, 80)}`
    );

    res.json({ success: true, message: `Email sent to ${to}` });
  } catch (err: any) {
    console.error("Email send error:", err);
    res.status(500).json({ error: err.message || "Failed to send email" });
  }
});

export default router;
