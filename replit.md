# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Applications

### Accounting Deadline Manager
- **Frontend**: `artifacts/accounting-dashboard` — React + Vite, navy/red theme, served at `/`
- **Backend**: `artifacts/api-server` — Express 5, served at `/api`
- **Data storage**: Replit PostgreSQL database (`clients` table) — data persists across restarts and deployments
- **Companies House proxy**: `GET /api/company/:number` — proxies to `api.company-information.service.gov.uk` using `CH_API_KEY` secret with Basic Auth
- **Key routes**: `/api/clients`, `/api/stats`, `/api/stats/postmortem`, `/api/proposals`, `/api/clients/export`, `/api/clients/:id/email-preview`, `/api/clients/:id/complete`, `/api/clients/:id/propose`, `/api/clients/:id/accept-proposal`, `/api/clients/:id/reject-proposal`, `/api/activity-log`
- **DB tables**: `clients`, `users`, `directors`, `activity_log`, `notification_settings`, `company_files`, `company_profiles`
- **Object Storage**: Replit GCS bucket provisioned (`replit-objstore-1c6b06d5-b7fb-4a3a-b0ab-9c411fae8436`); presigned-URL upload flow; files served at `/api/storage/objects/*`; metadata registered in `company_files` table
- **Company Portal**: New "Portal" tab in Company Profile dialog — upload photos (JPG/PNG/WebP) and compliance documents (PDF/DOCX/XLSX); photos displayed as image grid; documents shown as file cards with download + delete
- **Company Reference Profile Page**: Full-page reference profile at `/companies/:company_number/profile`; 40+ fields across 6 sections (Companies House, HMRC, Identity & Verification, Banking, Engagement & Billing, Notes) + Linked Deadlines table; view/edit mode toggle; CH data auto-prefill on creation; copy-to-clipboard per field; API-sensitive field masking (ch_password, gateway_password via `?include_sensitive=true`); locally-sensitive field masking with eye-icon reveal (UTR, NINO, sort code, account number, auth code, etc.); BookOpen icon button in client table (non-SE clients only) navigates to this page
- **New DB columns on `clients`**: `buffer_days` (INTEGER), `linked_deadline_id` (UUID FK→clients), `assignee_timezone` (VARCHAR 64), `extension_count` (INTEGER), `proposed_due_date` (DATE), `proposal_status` (VARCHAR 20), `days_late` (INTEGER)

### Advanced Features (10 implemented)
1. **Health Score** — coloured badge in table (score 0–100, Good/At Risk/Critical tiers)
2. **Slippage Prediction** — AlertTriangle/Clock icons per row; scheduler logs high-risk once/day
3. **Buffer Time Manager** — `buffer_days` per deadline; "Aim for" secondary date shown below due date; configurable in Add Client dialog
4. **Cascading Deadlines** — when a due date changes, linked deadlines shift by same delta; logged in audit trail
5. **Focus Mode** — `/focus` page: overdue + due ≤7 days deadlines as cards with Mark Complete button
6. **Timezone-Aware Deadlines** — `assignee_timezone` stored; localised date shown in due-date tooltip; timezone picker in Add Client dialog
7. **Audit Trail** — `/audit` page: structured JSON diff logs for every update/delete/complete; filterable by action and client
8. **Burnout Detection** — `extension_count` auto-incremented on each due-date change; flame icon shown when ≥3
9. **Negotiation Mode** — calendar-clock icon in table opens Propose New Date dialog; `/proposals` page to accept/reject; proposal flow via PUT routes
10. **Post-Mortem Analysis** — `/reports/postmortem` page: avg days late by type, completed-late count, top-extended clients; `days_late` recorded on completion

### Frontend Pages
- `/` — Dashboard (stats cards + grouped deadline table with health scores, slip risk, burnout flame, buffer dates)
- `/upcoming` — Upcoming Deadlines Feed (chronological, filterable 30/60/90 days)
- `/calendar` — Monthly Calendar view (deadlines plotted by due date, click to inspect)
- `/focus` — Focus Mode (urgent deadlines only: overdue + due within 7 days)
- `/reports` — Reports & Analytics (recharts: bar by month, pie by status, bar by type)
- `/reports/postmortem` — Post-Mortem Analysis (late completion stats, extension ranking)
- `/activity` — Activity Log (timestamped record of all system events)
- `/audit` — Audit Trail (filtered, structured JSON diff view of all changes)
- `/proposals` — Date Extension Proposals (accept/reject pending proposals)
- `/clients/:companyNumber` — Client Profile (all deadlines + directors for one company)
- `/clients` — Clients page
- `/companies` — Companies page
- `/settings` — Settings page

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
