import { useQuery } from "@tanstack/react-query";
import { SafeUser, Booking, type QualificationWithStatus } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, AlertCircle, Car, Award, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { format, differenceInHours, isPast } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SoldierDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: bookings = [], isLoading: bookingsLoading, refetch } = useQuery<Booking[]>({
    queryKey: ["/api/bookings/my"],
  });

  const { data: qualifications = [], isLoading: qualificationsLoading } = useQuery<QualificationWithStatus[]>({
    queryKey: ["/api/qualifications/my"],
  });

  const upcomingBookings = bookings
    .filter(b => b.status === "active" && !isPast(new Date(b.endTime)))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const canCancelBooking = (booking: Booking) => {
    const hoursUntilStart = differenceInHours(new Date(booking.startTime), new Date());
    return hoursUntilStart > 24;
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    
    setIsCancelling(true);
    try {
      await apiRequest("POST", `/api/bookings/${bookingToCancel.id}/cancel`);
      toast({
        title: "Booking cancelled",
        description: canCancelBooking(bookingToCancel) 
          ? "Your credits have been refunded."
          : "Cancelled within 24 hours - no refund.",
      });
      refetch();
      setBookingToCancel(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to cancel booking",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-16">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            <Skeleton className="h-32 w-full mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Skeleton className="h-96 lg:col-span-2" />
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="Dashboard" />
      
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  className="h-12"
                  onClick={() => setLocation("/mess-booking")}
                  data-testid="button-open-calendar"
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Book Mess Room
                </Button>

                <Button
                  className="h-12"
                  onClick={() => setLocation("/my-currency?openLogDrive=true")}
                  data-testid="button-log-drive"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Log Drive
                </Button>
              </div>

              {user.credits < 1 && (
                <div className="border border-destructive/50 rounded-md p-4 bg-destructive/5 mt-4">
                  <div className="flex gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-destructive mb-1">
                        Low Credits
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Contact your administrator for credit top-up
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center">
                  <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Mess Credits
                  </p>
                  <p className="text-4xl font-mono font-semibold" data-testid="text-available-credits">
                    {user.credits.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    1 credit = 1 hour of booking
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Driver Currency
                </CardTitle>
              </CardHeader>
              <CardContent>
                {qualificationsLoading ? (
                  <Skeleton className="h-16" />
                ) : qualifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <Award className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No qualifications</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {qualifications.map((qual) => (
                      <div key={qual.id} className="flex items-center justify-between p-2 border rounded-md">
                        <div>
                          <p className="font-medium text-sm">{qual.vehicleType}</p>
                          <p className="text-xs text-muted-foreground">
                            {qual.daysRemaining > 0 ? `${qual.daysRemaining} days left` : "Expired"}
                          </p>
                        </div>
                        <Badge
                          variant={qual.status === "CURRENT" ? "outline" : qual.status === "EXPIRING_SOON" ? "secondary" : "destructive"}
                          className={
                            qual.status === "CURRENT"
                              ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                              : qual.status === "EXPIRING_SOON"
                              ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                              : ""
                          }
                        >
                          {qual.status === "CURRENT" ? "Current" : qual.status === "EXPIRING_SOON" ? "Expiring" : "Expired"}
                        </Badge>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      size="sm"
                      onClick={() => setLocation("/my-currency")}
                      data-testid="button-view-currency"
                    >
                      View Full Currency
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Upcoming Bookings</CardTitle>
                <CardDescription>Your active reservations</CardDescription>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : upcomingBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No upcoming bookings</p>
                    <Button
                      className="mt-4"
                      onClick={() => setLocation("/mess-booking")}
                      data-testid="button-create-first-booking"
                    >
                      Book Time Slot
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="border rounded-md p-4 hover-elevate"
                        data-testid={`booking-${booking.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-medium">
                                {format(new Date(booking.startTime), "EEE, MMM d, yyyy")}
                              </p>
                              <Badge variant="secondary" className="bg-green-500 text-green-950">
                                Active
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {format(new Date(booking.startTime), "HH:mm")} -{" "}
                                  {format(new Date(booking.endTime), "HH:mm")}
                                </span>
                              </div>
                              <span className="font-mono font-semibold">
                                {booking.creditsCharged.toFixed(1)} credits
                              </span>
                            </div>
                          </div>
                          <div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setBookingToCancel(booking)}
                              data-testid={`button-cancel-${booking.id}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
        </div>
      </div>

      <AlertDialog open={!!bookingToCancel} onOpenChange={() => setBookingToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              {bookingToCancel && canCancelBooking(bookingToCancel) ? (
                <>You will receive a full refund of {bookingToCancel.creditsCharged.toFixed(1)} credits.</>
              ) : (
                <>Cancelling within 24 hours of start time. No credits will be refunded.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? "Cancelling..." : "Cancel Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
