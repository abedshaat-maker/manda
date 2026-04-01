import { useState } from "react";
import { Megaphone } from "lucide-react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ClientTable } from "@/components/dashboard/client-table";
import { Sidebar } from "@/components/layout/sidebar";
import { AnnouncementDialog } from "@/components/dashboard/announcement-dialog";
import { Button } from "@/components/ui/button";

export default function ClientsPage() {
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Clients</h1>
              <p className="text-muted-foreground mt-1">Manage all client deadlines</p>
            </div>
            <Button
              onClick={() => setAnnouncementOpen(true)}
              className="rounded-xl bg-[#0d1b3e] hover:bg-[#0d1b3e]/90 text-white shadow-md shrink-0 mt-1"
            >
              <Megaphone className="w-4 h-4 mr-2" />
              Announce to All Clients
            </Button>
          </div>
          <StatsCards />
          <ClientTable />
        </div>
      </div>
      <AnnouncementDialog
        open={announcementOpen}
        onClose={() => setAnnouncementOpen(false)}
      />
    </div>
  );
}
