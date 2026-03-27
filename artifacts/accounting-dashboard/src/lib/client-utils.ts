import { differenceInDays, isBefore, startOfDay, parseISO, subDays } from "date-fns";
import type { Client } from "@workspace/api-client-react";

export type ComputedStatus = "completed" | "overdue" | "due_soon" | "pending";

export function getComputedStatus(client: Client): ComputedStatus {
  if (client.status === "completed") return "completed";
  
  const dueDate = parseISO(client.dueDate);
  const today = startOfDay(new Date());
  
  if (client.status === "overdue" || isBefore(dueDate, today)) {
    return "overdue";
  }
  
  const daysLeft = differenceInDays(dueDate, today);
  if (daysLeft <= 14) {
    return "due_soon";
  }
  
  return "pending";
}

export function getDaysLeft(dueDateStr: string): number {
  const dueDate = parseISO(dueDateStr);
  const today = startOfDay(new Date());
  return differenceInDays(dueDate, today);
}

export function getHealthScore(client: Client): number {
  const status = getComputedStatus(client);

  // Status component (40 pts max)
  let statusScore: number;
  if (status === "completed") {
    statusScore = 40;
  } else if (status === "overdue") {
    statusScore = 0;
  } else {
    statusScore = 20;
  }

  // Days remaining component (50 pts max)
  let daysScore: number;
  if (status === "completed") {
    daysScore = 25;
  } else {
    const daysLeft = getDaysLeft(client.dueDate);
    if (daysLeft <= 0) {
      daysScore = 0;
    } else {
      daysScore = Math.min(50, Math.round((daysLeft / 30) * 50));
    }
  }

  // Email proxy component (10 pts max) — has a reminder email address = 10
  const emailScore = client.clientEmail ? 10 : 0;

  return Math.min(100, statusScore + daysScore + emailScore);
}

export type HealthLabel = "Good" | "At Risk" | "Critical";
export type HealthTier = "green" | "amber" | "red";

export function getHealthTier(score: number): { tier: HealthTier; label: HealthLabel } {
  if (score >= 75) return { tier: "green", label: "Good" };
  if (score >= 40) return { tier: "amber", label: "At Risk" };
  return { tier: "red", label: "Critical" };
}

export type SlipRisk = "high" | "medium" | "low";

export function predictSlipRisk(client: Client): SlipRisk {
  const status = getComputedStatus(client);

  if (status === "completed") return "low";

  if (status === "overdue") return "high";

  const daysLeft = getDaysLeft(client.dueDate);

  if (daysLeft <= 14 && !client.clientEmail) return "high";

  if (daysLeft <= 30) return "medium";

  return "low";
}

// Feature 3: Buffer Time Manager
export function getBufferDate(dueDateStr: string, bufferDays: number | null | undefined): Date | null {
  const days = bufferDays ?? 3;
  if (days <= 0) return null;
  const due = parseISO(dueDateStr);
  return subDays(due, days);
}

// Feature 6: Timezone-Aware Deadlines
export function getLocalDueDate(dueDateStr: string, timezone: string | null | undefined): string | null {
  if (!timezone) return null;
  try {
    const date = new Date(dueDateStr + "T00:00:00Z");
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return null;
  }
}
