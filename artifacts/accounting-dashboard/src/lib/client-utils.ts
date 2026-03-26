import { differenceInDays, isBefore, startOfDay, parseISO } from "date-fns";
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
