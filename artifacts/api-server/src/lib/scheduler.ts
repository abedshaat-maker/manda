import nodemailer from "nodemailer";
import {
  loadClients,
  computeDaysLeft,
  autoUpdateStatuses,
  getNotificationSettings,
  markNotificationSent,
  logActivity,
  hasActivityLoggedToday,
} from "./dataStore.js";
import { logger } from "./logger.js";

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
    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

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
      "Log in to ADM Pro to view and manage all deadlines.",
    ].join("\n");

    const subject = overdue.length > 0
      ? `🚨 ADM Pro: ${overdue.length} overdue + ${upcoming.length} upcoming deadline${upcoming.length !== 1 ? "s" : ""}`
      : `📅 ADM Pro: ${upcoming.length} deadline${upcoming.length !== 1 ? "s" : ""} due within ${window} days`;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"ADM Pro Notifications" <${process.env.SMTP_USER}>`,
      to: settings.email,
      subject,
      text: bodyText,
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

      // Run slip risk detection every minute regardless of notification settings
      await runSlipRiskDetection();
    } catch {
      // Silently ignore scheduler errors
    }
  }, INTERVAL_MS);

  logger.info("Deadline notification scheduler started");
}
