import nodemailer from "nodemailer";
import {
  loadClients,
  computeDaysLeft,
  autoUpdateStatuses,
  getNotificationSettings,
  markNotificationSent,
  logActivity,
  hasActivityLoggedToday,
  hasReminderBeenSent,
} from "./dataStore.js";
import { logger } from "./logger.js";
import { getLogoAttachment, buildEmailHtml } from "./emailTemplate.js";

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

function computeSlipRisk(client: {
  status: string;
  dueDate: string;
  clientEmail: string | null;
}): "high" | "medium" | "low" {
  if (client.status === "completed") return "low";
  if (client.status === "overdue") return "high";
  const daysLeft = computeDaysLeft(client.dueDate);
  if (daysLeft <= 14 && !client.clientEmail) return "high";
  if (daysLeft <= 30) return "medium";
  return "low";
}

async function runSlipRiskDetection(): Promise<void> {
  try {
    const clients = await loadClients();
    for (const client of clients) {
      const risk = computeSlipRisk(client);
      if (risk !== "high") continue;

      const entityName = `${client.clientName} — ${client.deadlineType}`;
      const alreadyLogged = await hasActivityLoggedToday("slip_risk_detected", entityName);
      if (alreadyLogged) continue;

      const daysLeft = computeDaysLeft(client.dueDate);
      await logActivity(
        "slip_risk_detected",
        "deadline",
        entityName,
        JSON.stringify({ due_date: client.dueDate, days_left: daysLeft, status: client.status })
      );
    }
  } catch (err) {
    logger.error({ err }, "Slip risk detection failed");
  }
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Sends the 14-day and 7-day milestone reminder emails to the admin.
 *  Each reminder fires exactly once per deadline (tracked in activity_log). */
async function runMilestoneReminders(): Promise<void> {
  try {
    const settings = await getNotificationSettings();
    if (!settings.enabled || !settings.email) return;
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    await autoUpdateStatuses();
    const clients = await loadClients(false); // exclude archived

    type MilestoneClient = { client: typeof clients[0]; days: number };

    const twoWeek: MilestoneClient[] = [];
    const oneWeek: MilestoneClient[] = [];

    for (const c of clients) {
      if (c.status === "completed") continue;
      const days = computeDaysLeft(c.dueDate);

      // 14-day window: 8–14 days left (catch-up window so missed days are covered)
      if (days >= 8 && days <= 14) {
        const key = `${c.id}::${c.dueDate}::14day`;
        const alreadySent = await hasReminderBeenSent("milestone_reminder_14day", key);
        if (!alreadySent) twoWeek.push({ client: c, days });
      }

      // 7-day window: 1–7 days left
      if (days >= 1 && days <= 7) {
        const key = `${c.id}::${c.dueDate}::7day`;
        const alreadySent = await hasReminderBeenSent("milestone_reminder_7day", key);
        if (!alreadySent) oneWeek.push({ client: c, days });
      }
    }

    const logoAttachment = await getLogoAttachment();
    const transporter = createTransporter();

    // ── 14-day batch ──────────────────────────────────────────────────────────
    if (twoWeek.length > 0) {
      const rowsHtml = twoWeek.map(({ client: c, days }) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e8f0fb;">
            <strong>${c.clientName}</strong> — ${c.deadlineType}
            <br /><span style="color:#888;font-size:13px;">${c.companyName} &nbsp;·&nbsp; Due: ${fmtDate(c.dueDate)} &nbsp;·&nbsp; ${days} day${days === 1 ? "" : "s"} left</span>
          </td>
        </tr>`).join("");

      const bodyHtml = buildEmailHtml(`
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1a4fa8;">📅 2-Week Deadline Reminder</p>
        <p style="margin:0 0 20px;color:#555;">The following deadline${twoWeek.length > 1 ? "s are" : " is"} due in approximately <strong>2 weeks</strong>. Please ensure all necessary documents and information are being prepared.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c8ddf8;border-radius:6px;background:#f5f9fe;margin-bottom:16px;">
          ${rowsHtml}
        </table>
        <p style="margin:0;color:#888;font-size:13px;">A follow-up reminder will be sent 1 week before each deadline.</p>
      `, !!logoAttachment);

      const textBody = [
        "2-WEEK DEADLINE REMINDER",
        "=".repeat(50),
        "",
        ...twoWeek.map(({ client: c, days }) =>
          `  • ${c.clientName} — ${c.deadlineType} (${c.companyName})\n    Due: ${fmtDate(c.dueDate)} · ${days} day${days === 1 ? "" : "s"} left`
        ),
        "",
        "A follow-up reminder will be sent 1 week before each deadline.",
      ].join("\n");

      await transporter.sendMail({
        from: `"Manda London Deadline Manager" <${process.env.SMTP_USER}>`,
        to: settings.email,
        subject: `📅 2-Week Reminder: ${twoWeek.length} deadline${twoWeek.length > 1 ? "s" : ""} due in ~2 weeks`,
        text: textBody,
        html: bodyHtml,
        attachments: logoAttachment ? [logoAttachment] : [],
      });

      for (const { client: c } of twoWeek) {
        const key = `${c.id}::${c.dueDate}::14day`;
        await logActivity("milestone_reminder_14day", "notification", key,
          `2-week reminder sent for ${c.clientName} — ${c.deadlineType}`);
      }

      logger.info({ count: twoWeek.length }, "14-day milestone reminder sent");
    }

    // ── 7-day batch ───────────────────────────────────────────────────────────
    if (oneWeek.length > 0) {
      const rowsHtml = oneWeek.map(({ client: c, days }) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #fde8e8;">
            <strong>${c.clientName}</strong> — ${c.deadlineType}
            <br /><span style="color:#888;font-size:13px;">${c.companyName} &nbsp;·&nbsp; Due: ${fmtDate(c.dueDate)} &nbsp;·&nbsp;
            ${days === 1 ? "<strong style='color:#c0392b;'>TOMORROW</strong>" : `<strong style="color:#c0392b;">${days} days left</strong>`}</span>
          </td>
        </tr>`).join("");

      const bodyHtml = buildEmailHtml(`
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#c0392b;">⚠️ 1-Week Deadline Reminder — Urgent</p>
        <p style="margin:0 0 20px;color:#555;">The following deadline${oneWeek.length > 1 ? "s are" : " is"} due in <strong>1 week or less</strong>. Immediate action may be required.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f5c6c6;border-radius:6px;background:#fff8f8;margin-bottom:16px;">
          ${rowsHtml}
        </table>
        <p style="margin:0;color:#888;font-size:13px;">Please log in to the Manda London Deadline Manager to review and take action.</p>
      `, !!logoAttachment);

      const textBody = [
        "⚠️ 1-WEEK DEADLINE REMINDER — URGENT",
        "=".repeat(50),
        "",
        ...oneWeek.map(({ client: c, days }) =>
          `  • ${c.clientName} — ${c.deadlineType} (${c.companyName})\n    Due: ${fmtDate(c.dueDate)} · ${days === 1 ? "TOMORROW" : `${days} days left`}`
        ),
        "",
        "Please log in to the Manda London Deadline Manager to review and take action.",
      ].join("\n");

      await transporter.sendMail({
        from: `"Manda London Deadline Manager" <${process.env.SMTP_USER}>`,
        to: settings.email,
        subject: `⚠️ 1-Week Reminder: ${oneWeek.length} deadline${oneWeek.length > 1 ? "s" : ""} due in 7 days or less`,
        text: textBody,
        html: bodyHtml,
        attachments: logoAttachment ? [logoAttachment] : [],
      });

      for (const { client: c } of oneWeek) {
        const key = `${c.id}::${c.dueDate}::7day`;
        await logActivity("milestone_reminder_7day", "notification", key,
          `1-week reminder sent for ${c.clientName} — ${c.deadlineType}`);
      }

      logger.info({ count: oneWeek.length }, "7-day milestone reminder sent");
    }
  } catch (err) {
    logger.error({ err }, "Milestone reminder check failed");
  }
}

export async function runNotificationCheck(): Promise<{ sent: boolean; count: number; reason?: string }> {
  try {
    const settings = await getNotificationSettings();

    if (!settings.enabled) return { sent: false, count: 0, reason: "Notifications disabled" };
    if (!settings.email) return { sent: false, count: 0, reason: "No notification email configured" };
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return { sent: false, count: 0, reason: "SMTP credentials not configured" };
    }

    const today = new Date().toISOString().slice(0, 10);

    // Only send once per day
    if (settings.lastSentDate === today) {
      return { sent: false, count: 0, reason: "Already sent today" };
    }

    await autoUpdateStatuses();
    const clients = await loadClients();

    const window = settings.daysBefore;
    const upcoming = clients.filter((c) => {
      if (c.status === "completed") return false;
      const days = computeDaysLeft(c.dueDate);
      return days >= 0 && days <= window;
    });

    const overdue = clients.filter((c) => {
      if (c.status === "completed") return false;
      return computeDaysLeft(c.dueDate) < 0;
    });

    const allAlerts = [...overdue, ...upcoming];

    if (allAlerts.length === 0) {
      return { sent: false, count: 0, reason: "No deadlines to notify about" };
    }

    // Build email body
    const overdueLines = overdue.map((c) => {
      const days = Math.abs(computeDaysLeft(c.dueDate));
      return `  ⚠️  ${c.clientName} — ${c.deadlineType} (${c.companyName})\n       Was due: ${fmtDate(c.dueDate)} · ${days} day${days === 1 ? "" : "s"} overdue`;
    });

    const upcomingLines = upcoming.map((c) => {
      const days = computeDaysLeft(c.dueDate);
      return `  📅  ${c.clientName} — ${c.deadlineType} (${c.companyName})\n       Due: ${fmtDate(c.dueDate)} · ${days === 0 ? "TODAY" : `${days} day${days === 1 ? "" : "s"} left`}`;
    });

    const sections: string[] = [];
    if (overdueLines.length > 0) {
      sections.push(`OVERDUE (${overdueLines.length})\n${"─".repeat(40)}\n${overdueLines.join("\n\n")}`);
    }
    if (upcomingLines.length > 0) {
      sections.push(`UPCOMING WITHIN ${window} DAYS (${upcomingLines.length})\n${"─".repeat(40)}\n${upcomingLines.join("\n\n")}`);
    }

    const bodyText = [
      `Deadline Notification — ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
      "=".repeat(55),
      "",
      ...sections,
      "",
      "─".repeat(55),
      "Log in to Manda London Deadline Manager to view and manage all deadlines.",
    ].join("\n");

    const subject = overdue.length > 0
      ? `🚨 Manda London: ${overdue.length} overdue + ${upcoming.length} upcoming deadline${upcoming.length !== 1 ? "s" : ""}`
      : `📅 Manda London: ${upcoming.length} deadline${upcoming.length !== 1 ? "s" : ""} due within ${window} days`;

    const logoAttachment = await getLogoAttachment();

    // Build HTML version of the digest
    const overdueHtml = overdue.map((c) => {
      const days = Math.abs(computeDaysLeft(c.dueDate));
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <span style="color:#c0392b;font-weight:700;">⚠ OVERDUE</span>
          &nbsp;·&nbsp; <strong>${c.clientName}</strong> — ${c.deadlineType}
          <br /><span style="color:#888;font-size:13px;">${c.companyName} &nbsp;·&nbsp; Was due: ${fmtDate(c.dueDate)} &nbsp;·&nbsp; ${days} day${days === 1 ? "" : "s"} overdue</span>
        </td>
      </tr>`;
    }).join("");

    const upcomingHtml = upcoming.map((c) => {
      const days = computeDaysLeft(c.dueDate);
      const daysLabel = days === 0 ? "<strong>TODAY</strong>" : `${days} day${days === 1 ? "" : "s"} left`;
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <span style="color:#1a6fb5;font-weight:700;">📅 UPCOMING</span>
          &nbsp;·&nbsp; <strong>${c.clientName}</strong> — ${c.deadlineType}
          <br /><span style="color:#888;font-size:13px;">${c.companyName} &nbsp;·&nbsp; Due: ${fmtDate(c.dueDate)} &nbsp;·&nbsp; ${daysLabel}</span>
        </td>
      </tr>`;
    }).join("");

    const dateHeading = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    let digestHtml = `<p style="margin:0 0 20px;font-size:16px;color:#555;">Deadline notification for <strong>${dateHeading}</strong>.</p>`;

    if (overdueHtml) {
      digestHtml += `
        <p style="margin:0 0 6px;font-weight:700;color:#c0392b;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
          Overdue (${overdue.length})
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fde;border-radius:6px;margin-bottom:20px;background:#fff8f8;">
          ${overdueHtml}
        </table>`;
    }

    if (upcomingHtml) {
      digestHtml += `
        <p style="margin:0 0 6px;font-weight:700;color:#1a6fb5;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
          Upcoming within ${window} days (${upcoming.length})
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d8eaf8;border-radius:6px;margin-bottom:20px;background:#f5f9fe;">
          ${upcomingHtml}
        </table>`;
    }

    digestHtml += `<p style="margin:16px 0 0;color:#888;font-size:13px;">Log in to Manda London Deadline Manager to view and manage all deadlines.</p>`;

    const htmlBody = buildEmailHtml(digestHtml, !!logoAttachment);

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Manda London Deadline Manager" <${process.env.SMTP_USER}>`,
      to: settings.email,
      subject,
      text: bodyText,
      html: htmlBody,
      attachments: logoAttachment ? [logoAttachment] : [],
    });

    await markNotificationSent(today);
    await logActivity("Notification email sent", "notification", settings.email, `${allAlerts.length} deadline(s) in digest`);

    logger.info({ to: settings.email, count: allAlerts.length }, "Deadline notification sent");
    return { sent: true, count: allAlerts.length };
  } catch (err) {
    logger.error({ err }, "Failed to send notification email");
    return { sent: false, count: 0, reason: String(err) };
  }
}

export function startScheduler(): void {
  // Check every minute whether it's time to send the notification
  const INTERVAL_MS = 60 * 1000;

  setInterval(async () => {
    try {
      const settings = await getNotificationSettings();

      const now = new Date();
      const [hh, mm] = settings.sendTime.split(":").map(Number);
      const isTime = now.getHours() === hh && now.getMinutes() === mm;

      if (settings.enabled && settings.email && isTime) {
        await runNotificationCheck();
      }

      // Milestone reminders run once per minute check — each fires at most once per deadline
      await runMilestoneReminders();

      // Run slip risk detection every minute regardless of notification settings
      await runSlipRiskDetection();
    } catch {
      // Silently ignore scheduler errors
    }
  }, INTERVAL_MS);

  logger.info("Deadline notification scheduler started");
}
