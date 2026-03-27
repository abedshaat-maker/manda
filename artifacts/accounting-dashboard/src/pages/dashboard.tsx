import { StatsCards } from "@/components/dashboard/stats-cards";
import { ClientTable } from "@/components/dashboard/client-table";
import { Sidebar } from "@/components/layout/sidebar";
import { Calendar } from "lucide-react";

function TodayDate() {
  const now = new Date();
  return now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Top header bar */}
        <header className="flex-shrink-0 bg-primary border-b border-white/10 px-8 py-5">
          <div className="max-w-7xl mx-auto flex items-end justify-between">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">
                Accounting Deadline Manager
              </p>
              <h1 className="text-2xl font-display font-bold text-white tracking-tight leading-none">
                Deadline Overview
              </h1>
            </div>
            <div className="flex items-center gap-2 text-white/50 text-xs font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>{TodayDate()}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Sub-header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Key Metrics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Live snapshot of client filing obligations across Companies House and HMRC.
                </p>
              </div>
            </div>

            <section>
              <StatsCards />
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Client Deadlines</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All active clients and their upcoming filing deadlines.
                  </p>
                </div>
              </div>
              <ClientTable />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
