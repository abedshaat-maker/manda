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
  };
}

export function computeDaysLeft(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
}

export async function loadClients(): Promise<Client[]> {
  const { rows } = await pool.query(
    `SELECT * FROM clients ORDER BY due_date ASC`
  );
  return rows.map(rowToClient);
}

export async function createClient(
  data: Omit<Client, "id" | "createdAt" | "updatedAt">
): Promise<Client> {
  const { rows } = await pool.query(
    `INSERT INTO clients
       (client_name, client_email, company_number, company_name, deadline_type, due_date, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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

  if (fields.length === 0) {
    return getClientById(id);
  }

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
