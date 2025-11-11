import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import SoldierDashboard from "@/pages/SoldierDashboard";
import CalendarPage from "@/pages/CalendarPage";
import AdminDashboard from "@/pages/AdminDashboard";
import MyCurrency from "@/pages/MyCurrency";
import CurrencyTracker from "@/pages/CurrencyTracker";
import MessBooking from "@/pages/MessBooking";
import Users from "@/pages/Users";
import { SafeUser } from "@shared/schema";

function ProtectedRoute({ component: Component, allowedRoles }: { component: any; allowedRoles?: string[] }) {
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/dashboard"} />;
  }

  return <Component />;
}

function RootRedirect() {
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role === "admin") {
    return <Redirect to="/admin" />;
  }

  // Both soldiers and commanders go to soldier dashboard
  return <Redirect to="/dashboard" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={SoldierDashboard} allowedRoles={["soldier", "commander"]} />}
      </Route>
      <Route path="/calendar">
        {() => <ProtectedRoute component={CalendarPage} />}
      </Route>
      <Route path="/my-currency">
        {() => <ProtectedRoute component={MyCurrency} allowedRoles={["soldier", "commander"]} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={Users} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/currency-tracker">
        {() => <ProtectedRoute component={CurrencyTracker} allowedRoles={["admin", "commander"]} />}
      </Route>
      <Route path="/mess-booking">
        {() => <ProtectedRoute component={MessBooking} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
