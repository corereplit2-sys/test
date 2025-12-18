import { useQuery } from "@tanstack/react-query";
import { BookingWithUser } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInHours } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export function AdminBookings() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [cancellingBooking, setCancellingBooking] = useState<BookingWithUser | null>(null);

  // Helper function to get actual booking status (checks if time has passed)
  const getBookingStatus = (booking: BookingWithUser) => {
    // If already cancelled, always show as cancelled
    if (booking.status === "cancelled") {
      return { status: "Cancelled", variant: "destructive" as const, canCancel: false };
    }

    const now = new Date();
    const endTime = new Date(booking.endTime);

    if (endTime < now) {
      return { status: "Completed", variant: "default" as const, canCancel: false };
    }
    return {
      status: "Active",
      variant: "secondary" as const,
      canCancel: booking.status === "active",
    };
  };

  const { data: bookings = [], isLoading } = useQuery<BookingWithUser[]>({
    queryKey: ["/api/bookings"],
  });

  const filteredBookings = bookings.filter(
    (booking) =>
      booking.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.user?.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCancelBooking = async () => {
    if (!cancellingBooking) return;

    try {
      await apiRequest("POST", `/api/bookings/${cancellingBooking.id}/cancel`);

      const hoursUntilStart = differenceInHours(new Date(cancellingBooking.startTime), new Date());
      const willRefund = hoursUntilStart > 24;

      toast({
        title: "Booking cancelled",
        description: willRefund
          ? "Credits have been refunded to the user"
          : "Cancelled within 24 hours - no refund",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setCancellingBooking(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to cancel booking",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">All Bookings</CardTitle>
        <CardDescription>View and manage all reservations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by soldier name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-bookings"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No bookings found</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="space-y-3 md:hidden">
              {filteredBookings.map((booking) => {
                const duration = differenceInHours(
                  new Date(booking.endTime),
                  new Date(booking.startTime)
                );

                return (
                  <div
                    key={booking.id}
                    className="border rounded-md p-4 hover:bg-accent transition-colors"
                    data-testid={`booking-card-mobile-${booking.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-base">
                          {booking.user?.fullName || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.startTime), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={(() => {
                          const statusInfo = getBookingStatus(booking);
                          if (statusInfo.status === "Completed") {
                            return "bg-blue-500 text-blue-950";
                          } else if (statusInfo.status === "Active") {
                            return "bg-green-500 text-green-950";
                          } else {
                            return "bg-gray-500 text-gray-950";
                          }
                        })()}
                      >
                        {(() => {
                          const statusInfo = getBookingStatus(booking);
                          return statusInfo.status;
                        })()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="font-medium text-xs">
                          {format(new Date(booking.startTime), "HH:mm")} -{" "}
                          {format(new Date(booking.endTime), "HH:mm")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-medium text-xs">{duration}h</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Credits</p>
                        <p className="font-mono font-medium text-xs">
                          {booking.creditsCharged.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const statusInfo = getBookingStatus(booking);
                      return (
                        statusInfo.canCancel && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => setCancellingBooking(booking)}
                            data-testid={`button-cancel-booking-${booking.id}`}
                            disabled={cancellingBooking?.id === booking.id}
                          >
                            {cancellingBooking?.id === booking.id ? "Cancelling..." : "Cancel"}
                          </Button>
                        )
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block border rounded-md">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">
                        Soldier
                      </th>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">
                        Date
                      </th>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">
                        Time
                      </th>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">
                        Duration
                      </th>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">
                        Credits
                      </th>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">
                        Status
                      </th>
                      <th className="text-right text-sm font-semibold uppercase tracking-wide py-3 px-4">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => {
                      const duration = differenceInHours(
                        new Date(booking.endTime),
                        new Date(booking.startTime)
                      );

                      return (
                        <tr
                          key={booking.id}
                          className="border-t hover-elevate"
                          data-testid={`booking-row-${booking.id}`}
                        >
                          <td className="py-3 px-4 font-medium">
                            {booking.user?.fullName || "Unknown"}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {format(new Date(booking.startTime), "MMM d, yyyy")}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {format(new Date(booking.startTime), "HH:mm")} -{" "}
                            {format(new Date(booking.endTime), "HH:mm")}
                          </td>
                          <td className="py-3 px-4">{duration}h</td>
                          <td className="py-3 px-4 font-mono font-semibold">
                            {booking.creditsCharged.toFixed(1)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="secondary"
                              className={(() => {
                                const statusInfo = getBookingStatus(booking);
                                if (statusInfo.status === "Completed") {
                                  return "bg-blue-500 text-blue-950";
                                } else if (statusInfo.status === "Active") {
                                  return "bg-green-500 text-green-950";
                                } else {
                                  return "bg-gray-500 text-gray-950";
                                }
                              })()}
                            >
                              {(() => {
                                const statusInfo = getBookingStatus(booking);
                                return statusInfo.status;
                              })()}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              {(() => {
                                const statusInfo = getBookingStatus(booking);
                                return (
                                  statusInfo.canCancel && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => setCancellingBooking(booking)}
                                      data-testid={`button-cancel-booking-${booking.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  )
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={!!cancellingBooking} onOpenChange={() => setCancellingBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              {cancellingBooking && (
                <>
                  Cancel booking for {cancellingBooking.user?.fullName}?
                  {differenceInHours(new Date(cancellingBooking.startTime), new Date()) > 24
                    ? " Credits will be refunded."
                    : " Cancelling within 24 hours - no refund."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
