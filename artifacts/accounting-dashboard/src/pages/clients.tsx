import { StatsCards } from "@/components/dashboard/stats-cards";
import { ClientTable } from "@/components/dashboard/client-table";
import { Sidebar } from "@/components/layout/sidebar";

export default function ClientsPage() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Clients</h1>
            <p className="text-muted-foreground mt-1">Manage all client deadlines</p>
          </div>
          <StatsCards />
          <ClientTable />
        </div>
      </div>
    </div>
  );
}
