import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import companyRouter from "./company.js";
import clientsRouter from "./clients.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(companyRouter);
router.use(clientsRouter);

export default router;
