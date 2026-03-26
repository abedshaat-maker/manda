import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, "..", "..", "data");
const DATA_FILE = join(DATA_DIR, "clients.json");

export interface Client {
  id: string;
  clientName: string;
  companyNumber: string;
  companyName: string;
  deadlineType: string;
  dueDate: string;
  status: "pending" | "completed" | "overdue";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadClients(): Client[] {
  ensureDataDir();
  if (!existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const raw = readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) as Client[];
  } catch {
    return [];
  }
}

export function saveClients(clients: Client[]): void {
  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(clients, null, 2), "utf-8");
}

export function createClient(data: Omit<Client, "id" | "createdAt" | "updatedAt">): Client {
  const clients = loadClients();
  const now = new Date().toISOString();
  const client: Client = {
    ...data,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  clients.push(client);
  saveClients(clients);
  return client;
}

export function getClientById(id: string): Client | undefined {
  return loadClients().find((c) => c.id === id);
}

export function updateClient(id: string, data: Partial<Omit<Client, "id" | "createdAt">>): Client | null {
  const clients = loadClients();
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  clients[idx] = { ...clients[idx], ...data, updatedAt: new Date().toISOString() };
  saveClients(clients);
  return clients[idx];
}

export function deleteClient(id: string): boolean {
  const clients = loadClients();
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  clients.splice(idx, 1);
  saveClients(clients);
  return true;
}

export function computeDaysLeft(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function autoUpdateStatuses(): void {
  const clients = loadClients();
  let changed = false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const client of clients) {
    if (client.status === "completed") continue;
    const due = new Date(client.dueDate);
    due.setHours(0, 0, 0, 0);
    const newStatus: "overdue" | "pending" = due < now ? "overdue" : "pending";
    if (client.status !== newStatus) {
      client.status = newStatus;
      client.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveClients(clients);
}
