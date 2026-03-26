import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

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
  const session = req.session as any;
  if (session?.userId) {
    res.json({ loggedIn: true, username: session.username });
  } else {
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

    const session = req.session as any;
    session.userId = user.id;
    session.username = user.username;
    res.json({ loggedIn: true, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ loggedIn: false });
  });
});

router.post("/auth/change-password", async (req, res) => {
  const session = req.session as any;
  if (!session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
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
      [session.userId]
    );
    if (rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, session.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;
