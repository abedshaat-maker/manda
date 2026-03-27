import { Router, type IRouter } from "express";
import { getActivityLog, logActivity } from "../lib/dataStore.js";

const router: IRouter = Router();

router.get("/activity-log", async (_req, res) => {
  try {
    const entries = await getActivityLog(200);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Failed to load activity log" });
  }
});

router.post("/activity-log", async (req, res) => {
  const { action, entityType, entityName, details } = req.body as {
    action: string;
    entityType: string;
    entityName?: string;
    details?: string;
  };
  if (!action || !entityType) {
    res.status(400).json({ error: "action and entityType are required" });
    return;
  }
  try {
    await logActivity(action, entityType, entityName, details);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to log activity" });
  }
});

export default router;
