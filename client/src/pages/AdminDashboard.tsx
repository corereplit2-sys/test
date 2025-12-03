import { useQuery } from "@tanstack/react-query";
import { SafeUser, DashboardStats, type QualificationWithStatus } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, CreditCard, Car, AlertTriangle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, differenceInDays } from "date-fns";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  const { data: user, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: qualifications = [], isLoading: qualificationsLoading } = useQuery<QualificationWithStatus[]>({
    queryKey: ["/api/qualifications"],
  });

  const getComputedStatusForQual = (qual: QualificationWithStatus) => {
    const base = qual.lastDriveDate ?? qual.qualifiedOnDate;
    const expiry = addDays(new Date(base), 88);
    const today = new Date();
    const daysRemaining = differenceInDays(expiry, today);

    let status: "EXPIRED" | "EXPIRING_SOON" | "CURRENT";
    if (daysRemaining < 0) {
      status = "EXPIRED";
    } else if (daysRemaining <= 30) {
      status = "EXPIRING_SOON";
    } else {
      status = "CURRENT";
    }

    return { status, daysRemaining: Math.max(0, daysRemaining) };
  };

  const currencyStats = {
    total: qualifications.length,
    current: qualifications.filter(q => getComputedStatusForQual(q).status === "CURRENT").length,
    expiringSoon: qualifications.filter(q => getComputedStatusForQual(q).status === "EXPIRING_SOON").length,
    expired: qualifications.filter(q => getComputedStatusForQual(q).status === "EXPIRED").length,
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-16">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="Admin Dashboard" />
      
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="space-y-6 mb-8">
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Mess Booking Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Total Users
                    </CardTitle>
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <div className="text-3xl font-bold" data-testid="stat-total-users">
                        {stats?.totalUsers || 0}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Active Bookings Today
                    </CardTitle>
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <div className="text-3xl font-bold" data-testid="stat-active-bookings">
                        {stats?.activeBookingsToday || 0}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Credits Issued
                    </CardTitle>
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <div className="text-3xl font-bold" data-testid="stat-total-credits">
                        {stats?.totalCreditsIssued || 0}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Car className="w-5 h-5" />
                Driver Currency Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card
                  className="cursor-pointer hover-elevate active-elevate-2 transition-all"
                  onClick={() => setLocation("/currency-tracker")}
                  data-testid="card-total-qualifications"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Total Qualifications
                    </CardTitle>
                    <Car className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {qualificationsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <div className="text-3xl font-bold" data-testid="stat-total-qualifications">
                        {currencyStats.total}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover-elevate active-elevate-2 transition-all"
                  onClick={() => setLocation("/currency-tracker?status=CURRENT")}
                  data-testid="card-current-qualifications"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Current
                    </CardTitle>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    {qualificationsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <div className="text-3xl font-bold text-green-600" data-testid="stat-current-qualifications">
                          {currencyStats.current}
                        </div>
                        {currencyStats.total > 0 && (
                          <span className="text-sm text-muted-foreground">
                            ({Math.round((currencyStats.current / currencyStats.total) * 100)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover-elevate active-elevate-2 transition-all"
                  onClick={() => setLocation("/currency-tracker?status=EXPIRING_SOON")}
                  data-testid="card-expiring-qualifications"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Expiring Soon
                    </CardTitle>
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    {qualificationsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <div className="text-3xl font-bold text-yellow-600" data-testid="stat-expiring-qualifications">
                          {currencyStats.expiringSoon}
                        </div>
                        {currencyStats.total > 0 && (
                          <span className="text-sm text-muted-foreground">
                            ({Math.round((currencyStats.expiringSoon / currencyStats.total) * 100)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover-elevate active-elevate-2 transition-all"
                  onClick={() => setLocation("/currency-tracker?status=EXPIRED")}
                  data-testid="card-expired-qualifications"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Expired
                    </CardTitle>
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    {qualificationsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <div className="text-3xl font-bold text-destructive" data-testid="stat-expired-qualifications">
                          {currencyStats.expired}
                        </div>
                        {currencyStats.total > 0 && (
                          <span className="text-sm text-muted-foreground">
                            ({Math.round((currencyStats.expired / currencyStats.total) * 100)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
