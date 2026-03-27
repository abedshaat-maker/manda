import { Sidebar } from "./sidebar";

interface PageShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageShell({ title, subtitle, children, actions }: PageShellProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="flex-shrink-0 bg-primary border-b border-white/10 px-8 py-5">
          <div className="max-w-7xl mx-auto flex items-end justify-between gap-4">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">
                Accounting Deadline Manager
              </p>
              <h1 className="text-2xl font-display font-bold text-white tracking-tight leading-none">
                {title}
              </h1>
              <p className="text-white/55 text-sm mt-1.5">{subtitle}</p>
            </div>
            {actions && <div className="flex-shrink-0">{actions}</div>}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
