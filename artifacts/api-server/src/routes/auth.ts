import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || "adm-pro-jwt-secret-change-me-in-production";
const JWT_EXPIRES_IN = "7d";

const router: IRouter = Router();

async function ensureDefaultUser() {
  const { rows } = await pool.query(`SELECT COUNT(*) FROM users`);
  if (parseInt(rows[0].count, 10) === 0) {
    const hash = await bcrypt.hash("admin123", 10);
    await pool.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      ["admin", hash]
    );
  }
}

ensureDefaultUser().catch(console.error);

router.get("/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.json({ loggedIn: false });
    return;
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    res.json({ loggedIn: true, username: payload.username });
  } catch {
    res.json({ loggedIn: false });
  }
});

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, username, password_hash FROM users WHERE username = $1`,
      [username.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ loggedIn: true, username: user.username, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ loggedIn: false });
});

router.post("/auth/change-password", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let payload: { userId: string; username: string };
  try {
    payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Both current and new password are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  try {
    const { rows } = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [payload.userId]
    );
    if (rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, payload.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;
