import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Returns the logo buffer, or null if the file cannot be found. */
async function readLogoBuffer(): Promise<Buffer | null> {
  const candidates = [
    // Production: esbuild emits index.mjs into dist/, logo is copied into dist/public/
    path.join(__dirname, "public", "manda-logo-nobg.png"),
    // Dev: ts-node/tsx runs from src/lib/, logo lives in the dashboard public dir
    path.join(__dirname, "..", "..", "..", "..", "accounting-dashboard", "public", "manda-logo-nobg.png"),
    // Fallback: workspace root relative
    path.join(__dirname, "..", "..", "..", "..", "..", "artifacts", "accounting-dashboard", "public", "manda-logo-nobg.png"),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      // try next
    }
  }
  return null;
}

export interface LogoAttachment {
  filename: string;
  content: Buffer;
  cid: string;
}

/** Returns the nodemailer attachment object for the logo, or null. */
export async function getLogoAttachment(): Promise<LogoAttachment | null> {
  const buf = await readLogoBuffer();
  if (!buf) return null;
  return { filename: "manda-logo.png", content: buf, cid: "manda-logo-cid" };
}

/** Wraps arbitrary HTML body content in the branded Manda London email shell.
 *  Pass hasLogo=true when the logo CID attachment is included. */
export function buildEmailHtml(bodyHtml: string, hasLogo: boolean): string {
  const logoImg = hasLogo
    ? `<img src="cid:manda-logo-cid" alt="Manda London Ltd" style="display:block;max-height:52px;width:auto;" />`
    : `<span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Manda London Ltd</span>`;

  const footerLogo = hasLogo
    ? `<img src="cid:manda-logo-cid" alt="Manda London Ltd" style="display:block;max-height:38px;width:auto;margin-bottom:10px;" />`
    : `<p style="margin:0 0 6px;font-weight:700;color:#0d1b3e;font-size:14px;">Manda London Ltd</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f0f2f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- ── Header ── -->
          <tr>
            <td style="background-color:#0d1b3e;padding:20px 32px;">
              ${logoImg}
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:32px;color:#1a1a2e;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- ── Signature / Footer ── -->
          <tr>
            <td style="background-color:#f8f9fb;border-top:3px solid #c0392b;padding:24px 32px;">
              ${footerLogo}
              <p style="margin:0;color:#555;font-size:12px;line-height:1.5;">
                <strong>Manda London Ltd</strong> &nbsp;·&nbsp; Accounting Deadline Manager<br />
                This is an automated notification — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Converts a plain-text body (newlines) to basic HTML paragraphs. */
export function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => {
      const lines = para.split("\n").map((l) => escHtml(l)).join("<br />");
      return `<p style="margin:0 0 16px;">${lines}</p>`;
    })
    .join("");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
