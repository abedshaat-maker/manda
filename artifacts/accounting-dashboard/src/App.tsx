import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import Dashboard from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import ClientProfilePage from "@/pages/client-profile";
import CompaniesPage from "@/pages/companies";
import ReportsPage from "@/pages/reports";
import CalendarPage from "@/pages/calendar";
import UpcomingPage from "@/pages/upcoming";
import ActivityPage from "@/pages/activity";
import SettingsPage from "@/pages/settings";
import FocusPage from "@/pages/focus";
import AuditPage from "@/pages/audit";
import ProposalsPage from "@/pages/proposals";
import PostmortemPage from "@/pages/postmortem";
import CompanyProfilePage from "@/pages/company-profile-page";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/upcoming" component={UpcomingPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/reports/postmortem" component={PostmortemPage} />
      <Route path="/activity" component={ActivityPage} />
      <Route path="/audit" component={AuditPage} />
      <Route path="/focus" component={FocusPage} />
      <Route path="/proposals" component={ProposalsPage} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/clients/:companyNumber" component={ClientProfilePage} />
      <Route path="/companies" component={CompaniesPage} />
      <Route path="/companies/:company_number/profile" component={CompanyProfilePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { loggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginPage />;
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
