import { Router, type IRouter } from "express";
import {
  getNotificationSettings,
  saveNotificationSettings,
} from "../lib/dataStore.js";
import { runNotificationCheck } from "../lib/scheduler.js";

const router: IRouter = Router();

router.get("/notifications/settings", async (_req, res) => {
  try {
    const settings = await getNotificationSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Failed to load notification settings" });
  }
});

router.put("/notifications/settings", async (req, res) => {
  const body = req.body as {
    enabled?: boolean;
    email?: string;
    daysBefore?: number;
    sendTime?: string;
  };
  try {
    const updated = await saveNotificationSettings({
      enabled: body.enabled,
      email: body.email,
      daysBefore: body.daysBefore,
      sendTime: body.sendTime,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to save notification settings" });
  }
});

router.post("/notifications/test", async (_req, res) => {
  try {
    const result = await runNotificationCheck();
    if (result.sent) {
      res.json({ success: true, message: `Test notification sent — ${result.count} deadline(s) in digest.` });
    } else {
      res.json({ success: false, message: result.reason ?? "No notification sent." });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to send test notification" });
  }
});

export default router;
