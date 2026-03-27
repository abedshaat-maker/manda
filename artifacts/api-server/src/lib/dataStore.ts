import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

export interface Client {
  id: string;
  clientName: string;
  clientEmail: string | null;
  companyNumber: string;
  companyName: string;
  deadlineType: string;
  dueDate: string;
  status: "pending" | "completed" | "overdue";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Feature 3: Buffer Time Manager
  bufferDays: number | null;
  // Feature 4: Cascading Deadline Logic
  linkedDeadlineId: string | null;
  // Feature 6: Timezone-Aware Deadlines
  assigneeTimezone: string | null;
  // Feature 8: Burnout Detection
  extensionCount: number;
  // Feature 9: Negotiation Mode
  proposedDueDate: string | null;
  proposalStatus: "pending" | "accepted" | "rejected" | null;
  // Feature 10: Post-Mortem Analysis
  daysLate: number | null;
}

export interface ActivityLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityName: string | null;
  details: string | null;
  createdAt: string;
}

function rowToClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    clientName: row.client_name as string,
    clientEmail: (row.client_email as string | null) ?? null,
    companyNumber: row.company_number as string,
    companyName: row.company_name as string,
    deadlineType: row.deadline_type as string,
    dueDate: (row.due_date as Date).toISOString().slice(0, 10),
    status: row.status as "pending" | "completed" | "overdue",
    notes: (row.notes as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    bufferDays: (row.buffer_days as number | null) ?? null,
    linkedDeadlineId: (row.linked_deadline_id as string | null) ?? null,
    assigneeTimezone: (row.assignee_timezone as string | null) ?? null,
    extensionCount: (row.extension_count as number) ?? 0,
    proposedDueDate: row.proposed_due_date
      ? (row.proposed_due_date as Date).toISOString().slice(0, 10)
      : null,
    proposalStatus: (row.proposal_status as "pending" | "accepted" | "rejected" | null) ?? null,
    daysLate: (row.days_late as number | null) ?? null,
  };
}

export function computeDaysLeft(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export interface NotificationSettings {
  enabled: boolean;
  email: string;
  daysBefore: number;
  sendTime: string;
  lastSentDate: string | null;
}

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL DEFAULT 'client',
      entity_name VARCHAR(255),
      details TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled BOOLEAN NOT NULL DEFAULT false,
      email VARCHAR(255) NOT NULL DEFAULT '',
      days_before INTEGER NOT NULL DEFAULT 7,
      send_time VARCHAR(10) NOT NULL DEFAULT '09:00',
      last_sent_date DATE
    )
  `);
  await pool.query(`
    INSERT INTO notification_settings (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);

  // Safe migrations — all use IF NOT EXISTS
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS buffer_days INTEGER`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS linked_deadline_id UUID REFERENCES clients(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS assignee_timezone VARCHAR(64)`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS extension_count INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS proposed_due_date DATE`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS proposal_status VARCHAR(20)`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS days_late INTEGER`);
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const { rows } = await pool.query(`SELECT * FROM notification_settings WHERE id = 1`);
  if (rows.length === 0) {
    return { enabled: false, email: "", daysBefore: 7, sendTime: "09:00", lastSentDate: null };
  }
  const r = rows[0];
  return {
    enabled: r.enabled as boolean,
    email: r.email as string,
    daysBefore: r.days_before as number,
    sendTime: r.send_time as string,
    lastSentDate: r.last_sent_date ? (r.last_sent_date as Date).toISOString().slice(0, 10) : null,
  };
}

export async function saveNotificationSettings(
  settings: Partial<Omit<NotificationSettings, "lastSentDate">>
): Promise<NotificationSettings> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (settings.enabled !== undefined) { fields.push(`enabled = $${idx++}`); values.push(settings.enabled); }
  if (settings.email !== undefined) { fields.push(`email = $${idx++}`); values.push(settings.email); }
  if (settings.daysBefore !== undefined) { fields.push(`days_before = $${idx++}`); values.push(settings.daysBefore); }
  if (settings.sendTime !== undefined) { fields.push(`send_time = $${idx++}`); values.push(settings.sendTime); }
  if (fields.length === 0) return getNotificationSettings();
  await pool.query(`UPDATE notification_settings SET ${fields.join(", ")} WHERE id = 1`, values);
  return getNotificationSettings();
}

export async function markNotificationSent(date: string): Promise<void> {
  await pool.query(`UPDATE notification_settings SET last_sent_date = $1 WHERE id = 1`, [date]);
}

export async function loadClients(): Promise<Client[]> {
  const { rows } = await pool.query(`SELECT * FROM clients ORDER BY due_date ASC`);
  return rows.map(rowToClient);
}

export async function createClient(
  data: Omit<Client, "id" | "createdAt" | "updatedAt" | "extensionCount" | "proposedDueDate" | "proposalStatus" | "daysLate">
): Promise<Client> {
  const { rows } = await pool.query(
    `INSERT INTO clients
       (client_name, client_email, company_number, company_name, deadline_type, due_date, status, notes, buffer_days, linked_deadline_id, assignee_timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.clientName,
      data.clientEmail ?? null,
      data.companyNumber,
      data.companyName,
      data.deadlineType,
      data.dueDate,
      data.status,
      data.notes ?? null,
      data.bufferDays ?? null,
      data.linkedDeadlineId ?? null,
      data.assigneeTimezone ?? null,
    ]
  );
  return rowToClient(rows[0]);
}

export async function getClientById(id: string): Promise<Client | null> {
  const { rows } = await pool.query(`SELECT * FROM clients WHERE id = $1`, [id]);
  if (rows.length === 0) return null;
  return rowToClient(rows[0]);
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, "id" | "createdAt">>
): Promise<Client | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.clientName !== undefined) { fields.push(`client_name = $${idx++}`); values.push(data.clientName); }
  if (data.clientEmail !== undefined) { fields.push(`client_email = $${idx++}`); values.push(data.clientEmail); }
  if (data.companyNumber !== undefined) { fields.push(`company_number = $${idx++}`); values.push(data.companyNumber); }
  if (data.companyName !== undefined) { fields.push(`company_name = $${idx++}`); values.push(data.companyName); }
  if (data.deadlineType !== undefined) { fields.push(`deadline_type = $${idx++}`); values.push(data.deadlineType); }
  if (data.dueDate !== undefined) { fields.push(`due_date = $${idx++}`); values.push(data.dueDate); }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }
  if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }
  if (data.bufferDays !== undefined) { fields.push(`buffer_days = $${idx++}`); values.push(data.bufferDays); }
  if (data.linkedDeadlineId !== undefined) { fields.push(`linked_deadline_id = $${idx++}`); values.push(data.linkedDeadlineId); }
  if (data.assigneeTimezone !== undefined) { fields.push(`assignee_timezone = $${idx++}`); values.push(data.assigneeTimezone); }
  if (data.extensionCount !== undefined) { fields.push(`extension_count = $${idx++}`); values.push(data.extensionCount); }
  if (data.proposedDueDate !== undefined) { fields.push(`proposed_due_date = $${idx++}`); values.push(data.proposedDueDate); }
  if (data.proposalStatus !== undefined) { fields.push(`proposal_status = $${idx++}`); values.push(data.proposalStatus); }
  if (data.daysLate !== undefined) { fields.push(`days_late = $${idx++}`); values.push(data.daysLate); }

  if (fields.length === 0) return getClientById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE clients SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (rows.length === 0) return null;
  return rowToClient(rows[0]);
}

export async function deleteClient(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM clients WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function autoUpdateStatuses(): Promise<void> {
  await pool.query(`
    UPDATE clients
    SET status = CASE
      WHEN due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END,
    updated_at = NOW()
    WHERE status != 'completed'
      AND (
        (due_date < CURRENT_DATE AND status != 'overdue')
        OR (due_date >= CURRENT_DATE AND status = 'overdue')
      )
  `);
}

export async function getLinkedDeadlines(linkedToId: string): Promise<Client[]> {
  const { rows } = await pool.query(
    `SELECT * FROM clients WHERE linked_deadline_id = $1`,
    [linkedToId]
  );
  return rows.map(rowToClient);
}

export async function getProposals(): Promise<Client[]> {
  const { rows } = await pool.query(
    `SELECT * FROM clients WHERE proposal_status = 'pending' ORDER BY due_date ASC`
  );
  return rows.map(rowToClient);
}

export async function getPostmortemStats(): Promise<{
  avgDaysLateByType: Array<{ deadlineType: string; avgDaysLate: number; count: number }>;
  completedLateCount: number;
  topExtendedClients: Array<{ clientName: string; companyName: string; extensionCount: number }>;
}> {
  const [byType, lateCount, topExtended] = await Promise.all([
    pool.query(`
      SELECT deadline_type, AVG(days_late) as avg_days_late, COUNT(*) as cnt
      FROM clients
      WHERE days_late IS NOT NULL AND days_late > 0
      GROUP BY deadline_type
      ORDER BY avg_days_late DESC
    `),
    pool.query(`SELECT COUNT(*) as cnt FROM clients WHERE days_late IS NOT NULL AND days_late > 0`),
    pool.query(`
      SELECT client_name, company_name, MAX(extension_count) as ext
      FROM clients
      WHERE extension_count > 0
      GROUP BY client_name, company_name
      ORDER BY ext DESC
      LIMIT 3
    `),
  ]);

  return {
    avgDaysLateByType: byType.rows.map((r) => ({
      deadlineType: r.deadline_type as string,
      avgDaysLate: Math.round(Number(r.avg_days_late)),
      count: Number(r.cnt),
    })),
    completedLateCount: Number(lateCount.rows[0]?.cnt ?? 0),
    topExtendedClients: topExtended.rows.map((r) => ({
      clientName: r.client_name as string,
      companyName: r.company_name as string,
      extensionCount: Number(r.ext),
    })),
  };
}

export async function getActivityLog(limit = 200): Promise<ActivityLogEntry[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({
      id: r.id as number,
      action: r.action as string,
      entityType: r.entity_type as string,
      entityName: (r.entity_name as string | null) ?? null,
      details: (r.details as string | null) ?? null,
      createdAt: (r.created_at as Date).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function logActivity(
  action: string,
  entityType: string,
  entityName?: string,
  details?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO activity_log (action, entity_type, entity_name, details) VALUES ($1, $2, $3, $4)`,
      [action, entityType, entityName ?? null, details ?? null]
    );
  } catch {
    // Silently fail if table doesn't exist yet
  }
}

export async function hasActivityLoggedToday(
  action: string,
  entityName: string
): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM activity_log
       WHERE action = $1
         AND entity_name = $2
         AND created_at::date = CURRENT_DATE
       LIMIT 1`,
      [action, entityName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
