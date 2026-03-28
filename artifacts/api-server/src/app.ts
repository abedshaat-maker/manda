import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { initDb } from "./lib/dataStore.js";
import { startScheduler } from "./lib/scheduler.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", router);

// Serve frontend static files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

// index.html must NEVER be cached — always serve fresh so the browser
// picks up new JS/CSS hashes on each deployment.
const serveIndexHtml = (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(publicDir, "index.html"));
};

// Intercept index.html requests before express.static can handle them
app.get("/index.html", serveIndexHtml);

// Hashed assets — cache for 1 year (content-addressable, immutable)
app.use(
  "/assets",
  express.static(path.join(publicDir, "assets"), {
    maxAge: "1y",
    immutable: true,
  }),
);

// Everything else in public (favicon, logo, etc.) — short cache, no index.html
app.use(
  express.static(publicDir, {
    maxAge: "1h",
    index: false, // Do NOT auto-serve index.html — our route handles it
  }),
);

// SPA fallback — any unknown route returns index.html with no-cache
app.get("/{*any}", serveIndexHtml);

initDb()
  .then(() => startScheduler())
  .catch((err) => logger.error({ err }, "Failed to initialise DB tables"));

export default app;
