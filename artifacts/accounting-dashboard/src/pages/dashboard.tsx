import { StatsCards } from "@/components/dashboard/stats-cards";
import { ClientTable } from "@/components/dashboard/client-table";
import { Sidebar } from "@/components/layout/sidebar";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Subtle decorative background header */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-primary pointer-events-none -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background mix-blend-multiply opacity-90" />
          <img 
            src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
            alt="Header Background" 
            className="w-full h-full object-cover opacity-20 mix-blend-overlay"
          />
        </div>

        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 z-0">
          <div className="max-w-7xl mx-auto space-y-8">
            <header className="flex items-end justify-between text-white mb-10">
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight shadow-black/10 text-shadow-sm">
                  Deadline Manager
                </h1>
                <p className="text-white/80 mt-2 font-medium">
                  Track and manage client filing obligations across Companies House and HMRC.
                </p>
              </div>
            </header>

            <section>
              <StatsCards />
            </section>
            
            <section className="mt-8">
              <ClientTable />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
