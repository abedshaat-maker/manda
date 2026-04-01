import { Router, type IRouter } from "express";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import { getLogoAttachment, buildEmailHtml, textToHtml } from "../lib/emailTemplate.js";
import { logActivity } from "../lib/dataStore.js";
import pg from "pg";

const { Pool } = pg;

const router: IRouter = Router();

function getOpenAI() {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  });
}

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

async function getClientEmails(): Promise<{ email: string; name: string }[]> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });
  try {
    const result = await pool.query<{ client_email: string; client_name: string }>(`
      SELECT DISTINCT ON (client_email)
        client_email,
        client_name
      FROM clients
      WHERE client_email IS NOT NULL
        AND client_email != ''
        AND is_archived = false
      ORDER BY client_email, client_name
    `);
    return result.rows.map((r) => ({ email: r.client_email, name: r.client_name }));
  } finally {
    await pool.end();
  }
}

router.post("/announcements/generate", async (req, res) => {
  try {
    const { topic } = req.body as { topic?: string };
    if (!topic || topic.trim().length < 3) {
      res.status(400).json({ error: "Please provide an announcement topic." });
      return;
    }

    const openai = getOpenAI();

    const systemPrompt = `You are a professional business communications writer for Manda London Ltd, a reputable UK accounting firm. 
Write clear, warm, and professional client announcement emails. 
Always write in first-person plural ("We are pleased to...").
Keep the tone friendly but professional — never overly salesy or casual.
Do not include placeholders like [NAME] or [DATE] — write the email as ready-to-send.
Do not include a greeting like "Dear Client" or a sign-off — those are handled by the email template.`;

    const userPrompt = `Write a client announcement email for Manda London Ltd about: "${topic.trim()}"

Return your response as JSON with exactly two fields:
- "subject": a concise, professional email subject line (no more than 10 words)
- "body": the email body text (plain text, use newlines for paragraphs, 2-4 paragraphs, no markdown)

Return only valid JSON, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    let parsed: { subject: string; body: string };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      res.status(500).json({ error: "AI returned an unexpected format. Please try again." });
      return;
    }

    if (!parsed.subject || !parsed.body) {
      res.status(500).json({ error: "AI response was incomplete. Please try again." });
      return;
    }

    const recipients = await getClientEmails();

    res.json({
      subject: parsed.subject,
      body: parsed.body,
      recipientCount: recipients.length,
    });
  } catch (err: any) {
    console.error("Announcement generate error:", err);
    res.status(500).json({ error: err.message || "Failed to generate announcement." });
  }
});

router.post("/announcements/send", async (req, res) => {
  try {
    const { subject, body } = req.body as { subject?: string; body?: string };
    if (!subject || !body) {
      res.status(400).json({ error: "subject and body are required." });
      return;
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      res.status(500).json({ error: "Email credentials not configured on server." });
      return;
    }

    const recipients = await getClientEmails();
    if (recipients.length === 0) {
      res.status(400).json({ error: "No clients with email addresses found." });
      return;
    }

    const logoAttachment = await getLogoAttachment();
    const htmlBody = buildEmailHtml(textToHtml(body), !!logoAttachment);
    const transporter = createTransporter();

    let sent = 0;
    const failed: string[] = [];

    for (const recipient of recipients) {
      try {
        await transporter.sendMail({
          from: `"Manda London Ltd" <${process.env.SMTP_USER}>`,
          to: recipient.email,
          subject,
          text: body,
          html: htmlBody,
          attachments: logoAttachment ? [logoAttachment] : [],
        });
        sent++;
      } catch (err: any) {
        console.error(`Failed to send to ${recipient.email}:`, err.message);
        failed.push(recipient.email);
      }
    }

    await logActivity(
      "Announcement sent",
      "email",
      `Broadcast to ${sent} client(s)`,
      JSON.stringify({ subject: subject.substring(0, 80), sent, failed: failed.length })
    );

    res.json({
      success: true,
      sent,
      failed: failed.length,
      message: `Announcement sent to ${sent} client${sent !== 1 ? "s" : ""}${failed.length > 0 ? ` (${failed.length} failed)` : ""}.`,
    });
  } catch (err: any) {
    console.error("Announcement send error:", err);
    res.status(500).json({ error: err.message || "Failed to send announcement." });
  }
});

export default router;
