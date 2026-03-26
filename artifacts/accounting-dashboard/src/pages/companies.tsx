import { Sidebar } from "@/components/layout/sidebar";
import { Building2 } from "lucide-react";
import { useListClients } from "@workspace/api-client-react";

export default function CompaniesPage() {
  const { data: clients, isLoading } = useListClients();

  const companies = clients
    ? Object.values(
        clients.reduce<Record<string, { companyNumber: string; companyName: string; deadlines: number }>>((acc, c) => {
          if (!acc[c.companyNumber]) {
            acc[c.companyNumber] = { companyNumber: c.companyNumber, companyName: c.companyName, deadlines: 0 };
          }
          acc[c.companyNumber].deadlines++;
          return acc;
        }, {})
      )
    : [];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Companies</h1>
            <p className="text-muted-foreground mt-1">All registered companies with tracked deadlines</p>
          </div>

          {isLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Building2 className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-lg font-medium text-foreground">No companies yet</p>
              <p className="text-sm mt-1">Add clients from the Dashboard to see companies here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((co) => (
                <div key={co.companyNumber} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{co.companyName}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{co.companyNumber}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <span className="text-sm text-muted-foreground">
                      {co.deadlines} deadline{co.deadlines !== 1 ? "s" : ""} tracked
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
