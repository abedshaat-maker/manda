import {
  LayoutDashboard,
  Users,
  Settings,
  PieChart,
  Building,
  LogOut,
  TrendingUp,
  CalendarDays,
  ListOrdered,
  Activity,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_SECTIONS = [
  {
    label: "Overview",
    links: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/" },
      { icon: ListOrdered, label: "Upcoming", href: "/upcoming" },
      { icon: CalendarDays, label: "Calendar", href: "/calendar" },
    ],
  },
  {
    label: "Insights",
    links: [
      { icon: PieChart, label: "Reports", href: "/reports" },
      { icon: Activity, label: "Activity Log", href: "/activity" },
    ],
  },
  {
    label: "Management",
    links: [
      { icon: Users, label: "Clients", href: "/clients" },
      { icon: Building, label: "Companies", href: "/companies" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ],
  },
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

  function isActive(href: string) {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  }

  return (
    <div className="w-60 bg-sidebar flex-shrink-0 hidden lg:flex flex-col border-r border-sidebar-border/60 relative">
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/5 via-white/10 to-white/5" />

      {/* Logo / Brand */}
      <div className="px-5 py-5 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shadow-sm flex-shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-sidebar-foreground text-sm leading-none truncate">
              {firmName}
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 mt-0.5 tracking-wide uppercase font-medium">
              Deadline Manager
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto hide-scrollbar">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[9px] font-bold text-sidebar-foreground/30 uppercase tracking-widest px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 cursor-pointer text-sm ${
                      active
                        ? "bg-white/10 text-sidebar-foreground font-semibold"
                        : "text-sidebar-foreground/55 hover:bg-white/6 hover:text-sidebar-foreground/85 font-medium"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 w-0.5 h-5 bg-accent rounded-r-full" />
                    )}
                    <link.icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        active ? "text-accent" : "text-sidebar-foreground/40"
                      }`}
                    />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 border-t border-white/8 pt-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-white/5 transition-colors group">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400/80 to-primary flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 border border-white/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">{displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate">{username || "Accountant"}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                className="text-sidebar-foreground/30 hover:text-sidebar-foreground/70 transition-colors flex-shrink-0 p-1 rounded hover:bg-white/10"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
