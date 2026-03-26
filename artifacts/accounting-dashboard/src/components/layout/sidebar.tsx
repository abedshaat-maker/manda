import { LayoutDashboard, Users, Settings, PieChart, Building, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const links = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Clients", href: "/clients" },
  { icon: Building, label: "Companies", href: "/companies" },
  { icon: PieChart, label: "Reports", href: "/reports" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function Sidebar() {
  const [location] = useLocation();
  const [firmName, setFirmName] = useState("ADM Pro");
  const [accountantName, setAccountantName] = useState("");
  const { logout, username } = useAuth();

  useEffect(() => {
    const load = () => {
      const fn = localStorage.getItem("firm_name");
      const an = localStorage.getItem("accountant_name");
      if (fn) setFirmName(fn);
      if (an) setAccountantName(an);
    };
    load();
    window.addEventListener("storage", load);
    const interval = setInterval(load, 1000);
    return () => {
      window.removeEventListener("storage", load);
      clearInterval(interval);
    };
  }, []);

  const displayName = accountantName || firmName || "Your Firm";
  const initials = displayName ? getInitials(displayName) : "?";

  return (
    <div className="w-64 bg-sidebar flex-shrink-0 hidden lg:flex flex-col shadow-xl z-10">
      <div className="p-6">
        <div className="flex items-center gap-3 text-sidebar-foreground font-display font-bold text-xl tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <span className="truncate">{firmName}</span>
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
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-primary border-2 border-white/20 flex items-center justify-center text-sm font-bold text-white shadow-inner flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-xs text-sidebar-foreground/50">{username || "Accountant"}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                className="text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
