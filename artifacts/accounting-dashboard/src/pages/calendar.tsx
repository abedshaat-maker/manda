import { useState, useMemo } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { useListClients } from "@workspace/api-client-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Calendar } from "lucide-react";
import { getComputedStatus } from "@/lib/client-utils";
import type { Client } from "@workspace/api-client-react";

const STATUS_DOT: Record<string, string> = {
  overdue: "bg-red-500",
  due_soon: "bg-amber-500",
  pending: "bg-blue-500",
  completed: "bg-emerald-400",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const { data: clients = [], isLoading } = useListClients();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const deadlineMap = useMemo(() => {
    const map = new Map<string, Client[]>();
    for (const c of clients) {
      const key = c.dueDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [clients]);

  const selectedDeadlines = selectedDay ? (deadlineMap.get(selectedDay) ?? []) : [];

  return (
    <PageShell
      title="Calendar"
      subtitle="Monthly view of all client deadlines plotted by due date"
    >
      {/* Month navigation */}
      <div className="bg-card border border-border/60 rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-display font-bold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border/50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayDeadlines = deadlineMap.get(key) ?? [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const selected = selectedDay === key;
            const today = isToday(day);

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(selected ? null : key)}
                className={`min-h-[72px] p-2 text-left border-b border-r border-border/30 transition-colors ${
                  selected
                    ? "bg-primary/8"
                    : "hover:bg-muted/50"
                } ${!isCurrentMonth ? "opacity-35" : ""}`}
              >
                <span
                  className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold ${
                    today
                      ? "bg-primary text-white"
                      : "text-foreground"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {dayDeadlines.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {dayDeadlines.slice(0, 3).map((c) => {
                      const status = getComputedStatus(c);
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium leading-tight truncate
                            ${status === "overdue" ? "bg-red-50 text-red-700" :
                              status === "due_soon" ? "bg-amber-50 text-amber-700" :
                              status === "completed" ? "bg-emerald-50 text-emerald-700" :
                              "bg-blue-50 text-blue-700"}`}
                        >
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
                          <span className="truncate">{c.clientName}</span>
                        </div>
                      );
                    })}
                    {dayDeadlines.length > 3 && (
                      <p className="text-[10px] text-muted-foreground px-1">+{dayDeadlines.length - 3} more</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        {[
          { color: "bg-red-500", label: "Overdue" },
          { color: "bg-amber-500", label: "Due within 14 days" },
          { color: "bg-blue-500", label: "Upcoming" },
          { color: "bg-emerald-400", label: "Completed" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDay && selectedDeadlines.length > 0 && (
        <div className="bg-card border border-border/60 rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {format(parseISO(selectedDay), "EEEE, d MMMM yyyy")}
            <span className="text-sm font-normal text-muted-foreground">
              — {selectedDeadlines.length} deadline{selectedDeadlines.length !== 1 ? "s" : ""}
            </span>
          </h3>
          <div className="divide-y divide-border/50">
            {selectedDeadlines.map((c) => {
              const status = getComputedStatus(c);
              return (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.clientName}</p>
                    <p className="text-xs text-muted-foreground">{c.deadlineType} · {c.companyName}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    status === "overdue" ? "bg-red-100 text-red-700" :
                    status === "due_soon" ? "bg-amber-100 text-amber-700" :
                    status === "completed" ? "bg-emerald-100 text-emerald-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {status === "overdue" ? "Overdue" :
                     status === "due_soon" ? "Due soon" :
                     status === "completed" ? "Completed" : "Upcoming"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedDay && selectedDeadlines.length === 0 && (
        <div className="bg-card border border-border/60 rounded-lg shadow-sm p-6 text-center text-muted-foreground text-sm">
          No deadlines on {format(parseISO(selectedDay), "d MMMM yyyy")}.
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading calendar data…</div>
      )}
    </PageShell>
  );
}
