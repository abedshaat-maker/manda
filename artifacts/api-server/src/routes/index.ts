import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import companyRouter from "./company.js";
import clientsRouter from "./clients.js";
import authRouter from "./auth.js";
import activityRouter from "./activity.js";
import notificationsRouter from "./notifications.js";
import storageRouter from "./storage.js";
import companyProfilesRouter from "./companyProfiles.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(companyRouter);
router.use(clientsRouter);
router.use(activityRouter);
router.use(notificationsRouter);
router.use(storageRouter);
router.use(companyProfilesRouter);

export default router;
