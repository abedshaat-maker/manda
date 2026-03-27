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
  getLinkedDeadlines,
  getProposals,
  getPostmortemStats,
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

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
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

// Feature 10: Post-Mortem stats endpoint
router.get("/stats/postmortem", async (_req, res) => {
  try {
    const stats = await getPostmortemStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to load postmortem stats" });
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

// Feature 9: Get all pending proposals
router.get("/proposals", async (_req, res) => {
  try {
    const proposals = await getProposals();
    res.json(proposals);
  } catch (err) {
    res.status(500).json({ error: "Failed to load proposals" });
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
    bufferDays?: number | null;
    linkedDeadlineId?: string | null;
    assigneeTimezone?: string | null;
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
      bufferDays: body.bufferDays ?? null,
      linkedDeadlineId: body.linkedDeadlineId ?? null,
      assigneeTimezone: body.assigneeTimezone ?? null,
    });
    await logActivity(
      "Client added",
      "client",
      `${body.clientName} — ${body.deadlineType}`,
      JSON.stringify({ company: body.companyName, companyNumber: body.companyNumber, dueDate: body.dueDate })
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
    const existing = await getClientById(req.params.id);
    if (!existing) { res.status(404).json({ error: "Client not found" }); return; }

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    let extensionCount = existing.extensionCount;
    let dueDateDelta = 0;

    // Feature 8: Burnout Detection — track due_date extensions
    if (body.dueDate && body.dueDate !== existing.dueDate) {
      extensionCount = existing.extensionCount + 1;
      // Calculate delta for cascade
      const oldDate = new Date(existing.dueDate);
      const newDate = new Date(body.dueDate);
      dueDateDelta = Math.round((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
      changedFields.dueDate = { from: existing.dueDate, to: body.dueDate };
    }

    // Track other changed fields for audit
    const trackFields: Array<keyof typeof body> = ["clientName", "deadlineType", "status", "notes", "bufferDays"];
    for (const field of trackFields) {
      if (body[field] !== undefined && body[field] !== (existing as any)[field]) {
        changedFields[field] = { from: (existing as any)[field], to: body[field] };
      }
    }

    const updated = await updateClient(req.params.id, {
      ...body,
      extensionCount,
    });
    if (!updated) { res.status(404).json({ error: "Client not found" }); return; }

    // Feature 7: Structured audit trail
    if (Object.keys(changedFields).length > 0) {
      await logActivity(
        "Deadline updated",
        "deadline",
        `${existing.clientName} — ${existing.deadlineType}`,
        JSON.stringify({ changed_fields: changedFields })
      );
    }

    // Feature 4: Cascade due_date shifts to linked deadlines
    if (dueDateDelta !== 0) {
      const linked = await getLinkedDeadlines(req.params.id);
      for (const dep of linked) {
        const newDep = shiftDate(dep.dueDate, dueDateDelta);
        await updateClient(dep.id, { dueDate: newDep });
        await logActivity(
          "Cascade due date shift",
          "deadline",
          `${dep.clientName} — ${dep.deadlineType}`,
          JSON.stringify({ shifted_by: dueDateDelta, from: dep.dueDate, to: newDep, parent_id: req.params.id })
        );
      }
    }

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
      // Feature 7: Structured audit trail
      await logActivity(
        "Client deleted",
        "client",
        `${existing.clientName} — ${existing.deadlineType}`,
        JSON.stringify({ from: { status: existing.status, dueDate: existing.dueDate }, company: existing.companyName })
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
    if (!existing) { res.status(404).json({ error: "Client not found" }); return; }

    // Feature 10: Record days_late (positive = completed after due date, negative = before)
    const daysLeft = computeDaysLeft(existing.dueDate);
    const daysLate = -daysLeft; // negative daysLeft means overdue; daysLate = days after due date

    const updated = await updateClient(req.params.id, { status: "completed", daysLate });
    if (!updated) { res.status(404).json({ error: "Client not found" }); return; }

    // Feature 7: Structured audit trail
    await logActivity(
      "Deadline completed",
      "deadline",
      `${existing.clientName} — ${existing.deadlineType}`,
      JSON.stringify({
        changed_fields: { status: { from: existing.status, to: "completed" } },
        daysLate,
        dueDate: existing.dueDate,
        company: existing.companyName,
      })
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to mark complete" });
  }
});

// Feature 9: Propose a new due date
router.put("/clients/:id/propose", async (req, res) => {
  const { proposedDueDate } = req.body as { proposedDueDate: string };
  if (!proposedDueDate) { res.status(400).json({ error: "proposedDueDate is required" }); return; }
  try {
    const existing = await getClientById(req.params.id);
    if (!existing) { res.status(404).json({ error: "Client not found" }); return; }
    const updated = await updateClient(req.params.id, {
      proposedDueDate,
      proposalStatus: "pending",
    });
    await logActivity(
      "Date extension proposed",
      "deadline",
      `${existing.clientName} — ${existing.deadlineType}`,
      JSON.stringify({ currentDueDate: existing.dueDate, proposedDueDate })
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to propose date" });
  }
});

// Feature 9: Accept a proposal
router.put("/clients/:id/accept-proposal", async (req, res) => {
  try {
    const existing = await getClientById(req.params.id);
    if (!existing) { res.status(404).json({ error: "Client not found" }); return; }
    if (!existing.proposedDueDate) { res.status(400).json({ error: "No proposal to accept" }); return; }
    const updated = await updateClient(req.params.id, {
      dueDate: existing.proposedDueDate,
      proposalStatus: "accepted",
      proposedDueDate: null,
    });
    await logActivity(
      "Date extension accepted",
      "deadline",
      `${existing.clientName} — ${existing.deadlineType}`,
      JSON.stringify({ from: existing.dueDate, to: existing.proposedDueDate })
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to accept proposal" });
  }
});

// Feature 9: Reject a proposal
router.put("/clients/:id/reject-proposal", async (req, res) => {
  try {
    const existing = await getClientById(req.params.id);
    if (!existing) { res.status(404).json({ error: "Client not found" }); return; }
    const updated = await updateClient(req.params.id, {
      proposalStatus: "rejected",
      proposedDueDate: null,
    });
    await logActivity(
      "Date extension rejected",
      "deadline",
      `${existing.clientName} — ${existing.deadlineType}`,
      JSON.stringify({ currentDueDate: existing.dueDate, rejectedProposal: existing.proposedDueDate })
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to reject proposal" });
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
      JSON.stringify({ to, subject: subject.substring(0, 80) })
    );

    res.json({ success: true, message: `Email sent to ${to}` });
  } catch (err: any) {
    console.error("Email send error:", err);
    res.status(500).json({ error: err.message || "Failed to send email" });
  }
});

export default router;
