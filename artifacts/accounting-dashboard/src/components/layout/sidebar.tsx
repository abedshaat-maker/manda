import { LayoutDashboard, Users, Settings, PieChart, Building } from "lucide-react";
import { Link, useLocation } from "wouter";

const links = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Clients", href: "/clients" },
  { icon: Building, label: "Companies", href: "/companies" },
  { icon: PieChart, label: "Reports", href: "/reports" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-sidebar flex-shrink-0 hidden lg:flex flex-col shadow-xl z-10">
      <div className="p-6">
        <div className="flex items-center gap-3 text-sidebar-foreground font-display font-bold text-xl tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          ADM Pro
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {links.map((link) => {
          const active = location === link.href || (link.href !== "/" && location.startsWith(link.href));
          return (
            <Link
              key={link.label}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                active
                  ? "bg-white/10 text-sidebar-foreground font-medium shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground"
              }`}
            >
              <link.icon className={`w-5 h-5 ${active ? "text-accent" : ""}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 m-4 bg-white/5 rounded-xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-primary border-2 border-white/20 flex items-center justify-center text-sm font-bold text-white shadow-inner">
            JD
          </div>
          <div>
            <p className="text-sm font-medium text-sidebar-foreground">John Doe</p>
            <p className="text-xs text-sidebar-foreground/50">Senior Partner</p>
          </div>
        </div>
      </div>
    </div>
  );
}
