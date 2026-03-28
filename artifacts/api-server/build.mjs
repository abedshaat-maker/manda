import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, cp } from "node:fs/promises";
import { execSync } from "node:child_process";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(artifactDir, "..", "..");
const dashboardDir = path.resolve(workspaceRoot, "artifacts", "accounting-dashboard");

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  // Step 1: Build the API server
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "pdfkit",
      "fontkit",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  // Step 2: Build the frontend (accounting-dashboard)
  console.log("\n--- Building frontend (accounting-dashboard) ---");
  execSync("pnpm --filter @workspace/accounting-dashboard run build", {
    cwd: workspaceRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: "3000",
      BASE_PATH: "/",
      NODE_ENV: "production",
    },
  });

  // Step 3: Copy frontend build output into api-server dist/public
  const frontendDist = path.resolve(dashboardDir, "dist", "public");
  const targetPublic = path.resolve(distDir, "public");
  console.log(`\n--- Copying frontend from ${frontendDist} → ${targetPublic} ---`);
  await cp(frontendDist, targetPublic, { recursive: true });

  // Step 4: Copy the manda logo (public asset) into dist/public
  const logoSrc = path.resolve(dashboardDir, "public", "manda-logo-nobg.png");
  try {
    await cp(logoSrc, path.resolve(targetPublic, "manda-logo-nobg.png"));
  } catch {
    // logo may not exist — not fatal
  }

  // Step 5: Create a CDN-safe assets directory (NO index.html — only hashed assets)
  // The static CDN only serves these immutable hashed files. index.html is NEVER
  // in this directory so the CDN can never cache it — the api-server always serves
  // index.html fresh with no-cache headers.
  const cdnAssetsDir = path.resolve(distDir, "cdn-assets");
  const frontendAssets = path.resolve(frontendDist, "assets");
  console.log(`\n--- Creating CDN assets dir (no index.html) at ${cdnAssetsDir} ---`);
  await cp(frontendAssets, path.resolve(cdnAssetsDir, "assets"), { recursive: true });

  // Also copy logo into CDN dir so it can be served via CDN
  try {
    await cp(logoSrc, path.resolve(cdnAssetsDir, "manda-logo-nobg.png"));
  } catch {
    // not fatal
  }

  console.log("\n--- Build complete ---");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
