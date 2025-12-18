import { useQuery } from "@tanstack/react-query";
import { SafeUser, DashboardStats, type QualificationWithStatus } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Calendar,
  CreditCard,
  Car,
  AlertTriangle,
  CheckCircle,
  Clock,
  CalendarDays,
} from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, differenceInDays, format } from "date-fns";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  const { data: user, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: qualifications = [], isLoading: qualificationsLoading } = useQuery<
    QualificationWithStatus[]
  >({
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
    current: qualifications.filter((q) => getComputedStatusForQual(q).status === "CURRENT").length,
    expiringSoon: qualifications.filter(
      (q) => getComputedStatusForQual(q).status === "EXPIRING_SOON"
    ).length,
    expired: qualifications.filter((q) => getComputedStatusForQual(q).status === "EXPIRED").length,
  };

  // Calculate critical dates
  const getCriticalDates = () => {
    const today = new Date();
    const terrexQuals = qualifications.filter((q) => q.vehicleType === "TERREX");
    const belrexQuals = qualifications.filter((q) => q.vehicleType === "BELREX");

    const getEarliestSchedulingDeadline = (quals: QualificationWithStatus[]) => {
      if (quals.length === 0) return null;

      // Find the qualification with the earliest expiry among CURRENT and EXPIRING_SOON only
      // Skip EXPIRED ones since they're already past scheduling deadline
      const activeQuals = quals.filter((q) => {
        const status = getComputedStatusForQual(q).status;
        return status === "CURRENT" || status === "EXPIRING_SOON";
      });

      if (activeQuals.length === 0) return null;

      // Find the earliest expiry date
      const earliestQual = activeQuals.reduce(
        (earliest, qual) => {
          const baseDate = qual.lastDriveDate
            ? new Date(qual.lastDriveDate)
            : new Date(qual.qualifiedOnDate);
          const expiryDate = addDays(baseDate, 88);
          const earliestExpiry = earliest
            ? addDays(new Date(earliest.lastDriveDate || earliest.qualifiedOnDate), 88)
            : new Date("9999-12-31");

          return expiryDate < earliestExpiry ? qual : earliest;
        },
        null as QualificationWithStatus | null
      );

      if (!earliestQual) return null;

      // Count how many drivers expire by this same date (within 1 day)
      const earliestExpiryDate = addDays(
        new Date(earliestQual.lastDriveDate || earliestQual.qualifiedOnDate),
        88
      );
      const driversExpiringByThisDate = activeQuals.filter((qual) => {
        const expiryDate = addDays(new Date(qual.lastDriveDate || qual.qualifiedOnDate), 88);
        return Math.abs(differenceInDays(expiryDate, earliestExpiryDate)) <= 1; // Same day or 1 day difference
      });

      return {
        qualification: earliestQual,
        expiryDate: earliestExpiryDate,
        driverCount: driversExpiringByThisDate.length,
        drivers: driversExpiringByThisDate,
      };
    };

    const getUrgentSchedulingDeadline = (quals: QualificationWithStatus[]) => {
      if (quals.length === 0) return null;

      // Find the qualification that needs scheduling most urgently
      return quals
        .filter((q) => getComputedStatusForQual(q).status === "EXPIRING_SOON")
        .sort((a, b) => {
          const statusA = getComputedStatusForQual(a);
          const statusB = getComputedStatusForQual(b);
          return statusA.daysRemaining - statusB.daysRemaining;
        })[0];
    };

    const getOverdueDeadline = (quals: QualificationWithStatus[]) => {
      if (quals.length === 0) return null;

      // Find the most expired qualification
      return quals
        .filter((q) => getComputedStatusForQual(q).status === "EXPIRED")
        .sort((a, b) => {
          const statusA = getComputedStatusForQual(a);
          const statusB = getComputedStatusForQual(b);
          return statusA.daysRemaining - statusB.daysRemaining;
        })[0];
    };

    return {
      terrex: {
        earliestDeadline: getEarliestSchedulingDeadline(terrexQuals),
        urgentDeadline: getUrgentSchedulingDeadline(terrexQuals),
        overdueDeadline: getOverdueDeadline(terrexQuals),
      },
      belrex: {
        earliestDeadline: getEarliestSchedulingDeadline(belrexQuals),
        urgentDeadline: getUrgentSchedulingDeadline(belrexQuals),
        overdueDeadline: getOverdueDeadline(belrexQuals),
      },
      overall: {
        nextExpiring: qualifications
          .filter((q) => getComputedStatusForQual(q).status === "EXPIRING_SOON")
          .sort((a, b) => {
            const statusA = getComputedStatusForQual(a);
            const statusB = getComputedStatusForQual(b);
            return statusA.daysRemaining - statusB.daysRemaining;
          })[0],
        mostExpired: qualifications
          .filter((q) => getComputedStatusForQual(q).status === "EXPIRED")
          .sort((a, b) => {
            const statusA = getComputedStatusForQual(a);
            const statusB = getComputedStatusForQual(b);
            return statusA.daysRemaining - statusB.daysRemaining;
          })[0],
      },
    };
  };

  const criticalDates = getCriticalDates();

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-16">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
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
                <Clock className="w-5 h-5" />
                Upcoming Drive Deadlines
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* TERREX Next Deadline */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      TERREX Next Deadline
                    </CardTitle>
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    {qualificationsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : criticalDates.terrex.earliestDeadline ? (
                      <div>
                        <div
                          className={`text-lg font-bold ${
                            getComputedStatusForQual(
                              criticalDates.terrex.earliestDeadline.qualification
                            ).status === "EXPIRED"
                              ? "text-destructive"
                              : getComputedStatusForQual(
                                    criticalDates.terrex.earliestDeadline.qualification
                                  ).status === "EXPIRING_SOON"
                                ? "text-yellow-600"
                                : "text-green-600"
                          }`}
                        >
                          {format(criticalDates.terrex.earliestDeadline.expiryDate, "dd MMM yyyy")}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {criticalDates.terrex.earliestDeadline.driverCount} driver
                          {criticalDates.terrex.earliestDeadline.driverCount !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {
                            getComputedStatusForQual(
                              criticalDates.terrex.earliestDeadline.qualification
                            ).daysRemaining
                          }{" "}
                          days left
                        </p>
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-muted-foreground">
                        No active drivers
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* BELREX Next Deadline */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      BELREX Next Deadline
                    </CardTitle>
                    <CalendarDays className="w-5 h-5 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    {qualificationsLoading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : criticalDates.belrex.earliestDeadline ? (
                      <div>
                        <div
                          className={`text-lg font-bold ${
                            getComputedStatusForQual(
                              criticalDates.belrex.earliestDeadline.qualification
                            ).status === "EXPIRED"
                              ? "text-destructive"
                              : getComputedStatusForQual(
                                    criticalDates.belrex.earliestDeadline.qualification
                                  ).status === "EXPIRING_SOON"
                                ? "text-yellow-600"
                                : "text-green-600"
                          }`}
                        >
                          {format(criticalDates.belrex.earliestDeadline.expiryDate, "dd MMM yyyy")}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {criticalDates.belrex.earliestDeadline.driverCount} driver
                          {criticalDates.belrex.earliestDeadline.driverCount !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {
                            getComputedStatusForQual(
                              criticalDates.belrex.earliestDeadline.qualification
                            ).daysRemaining
                          }{" "}
                          days left
                        </p>
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-muted-foreground">
                        No active drivers
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
