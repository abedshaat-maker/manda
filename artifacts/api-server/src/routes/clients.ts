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

router.get("/clients/export", (_req, res) => {
  autoUpdateStatuses();
  const clients = loadClients();
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
});

router.get("/stats", (_req, res) => {
  autoUpdateStatuses();
  const clients = loadClients();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let overdue = 0;
  let dueSoon = 0;
  let upcoming = 0;
  let completed = 0;

  for (const c of clients) {
    if (c.status === "completed") {
      completed++;
      continue;
    }
    const days = computeDaysLeft(c.dueDate);
    if (days < 0) {
      overdue++;
    } else if (days <= 14) {
      dueSoon++;
    } else {
      upcoming++;
    }
  }

  res.json({
    total: clients.length,
    overdue,
    dueSoon,
    upcoming,
    completed,
  });
});

router.get("/clients", (_req, res) => {
  autoUpdateStatuses();
  const clients = loadClients();
  res.json(clients);
});

router.post("/clients", (req, res) => {
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

  const client = createClient({
    clientName: body.clientName,
    clientEmail: body.clientEmail ?? null,
    companyNumber: body.companyNumber,
    companyName: body.companyName,
    deadlineType: body.deadlineType,
    dueDate: body.dueDate,
    status: body.status,
    notes: body.notes ?? null,
  });

  res.status(201).json(client);
});

router.get("/clients/:id", (req, res) => {
  const client = getClientById(req.params.id);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(client);
});

router.put("/clients/:id", (req, res) => {
  const body = req.body as Partial<Omit<Client, "id" | "createdAt">>;
  const updated = updateClient(req.params.id, body);
  if (!updated) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(updated);
});

router.delete("/clients/:id", (req, res) => {
  const ok = deleteClient(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.status(204).send();
});

router.post("/clients/:id/complete", (req, res) => {
  const updated = updateClient(req.params.id, { status: "completed" });
  if (!updated) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(updated);
});

router.get("/clients/:id/email-preview", (req, res) => {
  const client = getClientById(req.params.id);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const days = computeDaysLeft(client.dueDate);
  const formattedDue = new Date(client.dueDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let urgencyLine = "";
  if (days < 0) {
    urgencyLine = `This deadline was ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago and is now overdue.`;
  } else if (days === 0) {
    urgencyLine = "This deadline is due TODAY.";
  } else if (days <= 7) {
    urgencyLine = `This deadline is due in ${days} day${days === 1 ? "" : "s"} — urgent action required.`;
  } else if (days <= 14) {
    urgencyLine = `This deadline is due in ${days} days — please act soon.`;
  } else {
    urgencyLine = `This deadline is due in ${days} days.`;
  }

  const subject = `Reminder: ${client.deadlineType} deadline for ${client.companyName} — due ${formattedDue}`;

  const body = `Dear ${client.clientName},

I hope this message finds you well.

I am writing to remind you that the following deadline is approaching for ${client.companyName} (Company No. ${client.companyNumber}):

  Deadline Type: ${client.deadlineType}
  Due Date:      ${formattedDue}

${urgencyLine}

Please ensure all required documents and information are ready in advance. Failure to file on time may result in penalties from HMRC or Companies House.

If you have any questions or require assistance, please do not hesitate to contact us.

Kind regards,
Your Accounting Team`;

  res.json({
    subject,
    body,
    clientName: client.clientName,
    clientEmail: client.clientEmail ?? null,
    dueDate: client.dueDate,
    deadlineType: client.deadlineType,
  });
});

router.post("/clients/:id/send-email", async (req, res) => {
  const client = getClientById(req.params.id);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const { to, subject, body } = req.body as { to: string; subject: string; body: string };

  if (!to || !subject || !body) {
    res.status(400).json({ error: "Missing to, subject, or body" });
    return;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    res.status(500).json({ error: "Email credentials not configured on server." });
    return;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Accounting Team"}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: body,
    });
    res.json({ success: true, message: `Email sent to ${to}` });
  } catch (err: any) {
    console.error("Email send error:", err);
    res.status(500).json({ error: err.message || "Failed to send email" });
  }
});

export default router;
