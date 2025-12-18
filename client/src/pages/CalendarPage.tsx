import { useQuery } from "@tanstack/react-query";
import {
  SafeUser,
  Booking,
  BookingWithUser,
  CapacityInfo,
  BookableWeekRange,
} from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  format,
  differenceInHours,
  differenceInMinutes,
  addHours,
  addDays,
  startOfDay,
  endOfDay,
  eachHourOfInterval,
} from "date-fns";
import { toZonedTime, format as formatTz } from "date-fns-tz";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, X, Users } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function CalendarPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const calendarRef = useRef<FullCalendar>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [bookingModal, setBookingModal] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [eventModal, setEventModal] = useState<BookingWithUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [capacityInfo, setCapacityInfo] = useState<CapacityInfo | null>(null);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [capacityBackgrounds, setCapacityBackgrounds] = useState<any[]>([]);

  const getTimeInSingapore = (date: Date | string) => {
    const utcDate = typeof date === "string" ? new Date(date) : date;
    return toZonedTime(utcDate, "Asia/Singapore");
  };

  const formatSingapore = (date: Date | string, fmtStr: string) => {
    return formatTz(getTimeInSingapore(date), fmtStr, { timeZone: "Asia/Singapore" });
  };

  const { data: user, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: bookings = [], refetch } = useQuery<BookingWithUser[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: bookableWeek, isLoading: weekLoading } = useQuery<BookableWeekRange>({
    queryKey: ["/api/config/booking-release-day"],
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-16">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            <Skeleton className="h-[600px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const events = useMemo(
    () => [
      ...bookings
        .filter((b) => b.status === "active")
        .map((booking) => ({
          id: booking.id,
          title:
            (user.role === "admin" || user.role === "commander") && booking.user
              ? `${booking.user.fullName} (${booking.creditsCharged}h)`
              : `Booked (${booking.creditsCharged}h)`,
          start: booking.startTime,
          end: booking.endTime,
          backgroundColor: booking.userId === user.id ? "#3b82f6" : "#6b7280",
          borderColor: booking.userId === user.id ? "#2563eb" : "#4b5563",
          extendedProps: {
            booking,
          },
        })),
      ...capacityBackgrounds,
    ],
    [bookings, capacityBackgrounds, user]
  );

  const handleDateClick = (clickInfo: any) => {
    // Create a proper Date object and round down to the nearest hour
    const clickedDate = new Date(clickInfo.dateStr || clickInfo.date);
    const start = new Date(clickedDate);
    start.setMinutes(0, 0, 0);
    const end = addHours(start, 1);

    if (start < new Date()) {
      toast({
        variant: "destructive",
        title: "Invalid selection",
        description: "Cannot book in the past",
      });
      return;
    }

    setBookingModal({ start, end });
  };

  // Generate capacity backgrounds for visible time slots
  const generateCapacityBackgrounds = useCallback(
    (start: Date, end: Date) => {
      try {
        // Generate all hour slots in the visible range
        const hours = eachHourOfInterval({ start, end });

        // Count bookings locally to avoid API spam
        const backgroundEvents = hours
          .filter((hourStart) => {
            const hourOfDay = hourStart.getHours();
            return hourOfDay >= 6 && hourOfDay < 22; // Business hours only
          })
          .map((hourStart) => {
            const hourEnd = addHours(hourStart, 1);

            // Count concurrent bookings for this hour from local bookings array
            const currentBookings = bookings.filter((booking) => {
              if (booking.status !== "active") return false;
              // Convert booking times to Singapore timezone for consistent comparison
              const bookingStart = getTimeInSingapore(booking.startTime);
              const bookingEnd = getTimeInSingapore(booking.endTime);
              // Check overlap: booking.start < hourEnd AND booking.end > hourStart
              return bookingStart < hourEnd && bookingEnd > hourStart;
            }).length;

            let backgroundColor = "";
            let borderColor = "";

            if (currentBookings >= 20) {
              backgroundColor = "rgba(239, 68, 68, 0.6)";
              borderColor = "rgba(239, 68, 68, 0.9)";
            } else if (currentBookings >= 15) {
              backgroundColor = "rgba(234, 179, 8, 0.6)";
              borderColor = "rgba(234, 179, 8, 0.9)";
            } else {
              backgroundColor = "rgba(34, 197, 94, 0.6)";
              borderColor = "rgba(34, 197, 94, 0.9)";
            }

            return {
              start: hourStart,
              end: hourEnd,
              display: "background",
              backgroundColor,
              borderColor,
            };
          });

        setCapacityBackgrounds(backgroundEvents);
      } catch (error) {
        console.error("Failed to generate capacity backgrounds:", error);
      }
    },
    [bookings]
  );

  // Fetch capacity backgrounds when bookings or bookable week changes
  useEffect(() => {
    if (bookableWeek) {
      const start = new Date(bookableWeek.start);
      const end = new Date(bookableWeek.end);
      generateCapacityBackgrounds(start, end);
    }
  }, [bookings, bookableWeek, generateCapacityBackgrounds]); // Refresh when bookings change

  // Fetch capacity when booking modal opens
  useEffect(() => {
    if (bookingModal) {
      const fetchCapacity = async () => {
        setLoadingCapacity(true);
        try {
          const params = new URLSearchParams({
            startTime: bookingModal.start.toISOString(),
            endTime: bookingModal.end.toISOString(),
          });
          const response = await fetch(`/api/bookings/capacity?${params}`);
          const data = await response.json();
          setCapacityInfo(data);
        } catch (error) {
          console.error("Failed to fetch capacity:", error);
          setCapacityInfo(null);
        } finally {
          setLoadingCapacity(false);
        }
      };
      fetchCapacity();
    } else {
      setCapacityInfo(null);
    }
  }, [bookingModal]);

  const handleEventClick = (clickInfo: any) => {
    const booking = clickInfo.event.extendedProps.booking;
    setEventModal(booking);
  };

  const handleCreateBooking = async () => {
    if (!bookingModal) return;

    const hours = differenceInHours(bookingModal.end, bookingModal.start);
    const creditsNeeded = Math.ceil(hours);

    if (creditsNeeded > user.credits) {
      toast({
        variant: "destructive",
        title: "Insufficient credits",
        description: `You need ${creditsNeeded} credits but only have ${user.credits.toFixed(1)}`,
      });
      return;
    }

    setIsCreating(true);
    try {
      // Ensure dates are proper Date objects before converting to ISO
      const startDate = new Date(bookingModal.start);
      const endDate = new Date(bookingModal.end);

      await apiRequest("POST", "/api/bookings", {
        userId: user.id,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        creditsCharged: creditsNeeded,
      });

      toast({
        title: "Booking created",
        description: `${creditsNeeded} credits deducted`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      refetch();
      setBookingModal(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Booking failed",
        description: error.message || "Failed to create booking",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!eventModal) return;

    const canCancel = eventModal.userId === user.id || user.role === "admin";
    if (!canCancel) {
      toast({
        variant: "destructive",
        title: "Not allowed",
        description: "You can only cancel your own bookings",
      });
      return;
    }

    setIsCancelling(true);
    try {
      await apiRequest("POST", `/api/bookings/${eventModal.id}/cancel`);

      const hoursUntilStart = differenceInHours(new Date(eventModal.startTime), new Date());
      const willRefund = hoursUntilStart > 24;

      toast({
        title: "Booking cancelled",
        description: willRefund
          ? `${eventModal.creditsCharged.toFixed(1)} credits refunded`
          : "No refund (cancelled within 24 hours)",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      refetch();
      setEventModal(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Cancellation failed",
        description: error.message || "Failed to cancel booking",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const creditsNeeded = bookingModal
    ? Math.ceil(differenceInHours(bookingModal.end, bookingModal.start))
    : 0;
  const hasEnoughCredits = creditsNeeded <= user.credits;

  // Check if user already has a booking for this time slot
  const userAlreadyBooked = bookingModal
    ? bookings
        .filter((b) => b.status === "active" && b.userId === user.id)
        .some((booking) => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          // Check overlap: booking.start < new.end AND booking.end > new.start
          return bookingStart < bookingModal.end && bookingEnd > bookingModal.start;
        })
    : false;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="Booking Calendar" />

      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {user.role === "soldier" && showInstructions && (
            <div className="mb-6 border rounded-md p-4 bg-accent/50 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">How to book</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click on any 1-hour time slot to book it. Click on existing bookings to view
                    details or cancel.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInstructions(false)}
                data-testid="button-dismiss-instructions"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {user.role === "soldier" && (
            <div className="mb-4 flex items-center gap-6 text-sm" data-testid="capacity-legend">
              <span className="font-medium text-muted-foreground">Availability:</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border-2"
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.6)",
                    borderColor: "rgba(34, 197, 94, 0.9)",
                  }}
                ></div>
                <span>Good (&lt;15)</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border-2"
                  style={{
                    backgroundColor: "rgba(234, 179, 8, 0.6)",
                    borderColor: "rgba(234, 179, 8, 0.9)",
                  }}
                ></div>
                <span>Limited (15-19)</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border-2"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.6)",
                    borderColor: "rgba(239, 68, 68, 0.9)",
                  }}
                ></div>
                <span>Full (20)</span>
              </div>
            </div>
          )}

          <div className="border rounded-md p-4 bg-card" data-testid="calendar-container">
            {weekLoading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : bookableWeek ? (
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                initialDate={bookableWeek.start}
                firstDay={0}
                timeZone="local"
                slotLabelFormat={(date) => {
                  const hours = date.date.hour.toString().padStart(2, "0");
                  const minutes = date.date.minute.toString().padStart(2, "0");
                  return `${hours}${minutes}`;
                }}
                eventTimeFormat={(date) => {
                  const hours = date.date.hour.toString().padStart(2, "0");
                  const minutes = date.date.minute.toString().padStart(2, "0");
                  return `${hours}${minutes}`;
                }}
                headerToolbar={{
                  left: "",
                  center: "title",
                  right: "",
                }}
                validRange={{
                  start: bookableWeek.start,
                  end: startOfDay(addDays(new Date(bookableWeek.end), 1)), // Sunday 00:00:00 (next week) to include all of Saturday (validRange.end is exclusive)
                }}
                editable={false}
                selectable={false}
                dayMaxEvents={true}
                weekends={true}
                events={events}
                dateClick={
                  user.role === "admin" || user.role === "commander" ? undefined : handleDateClick
                }
                eventClick={handleEventClick}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                allDaySlot={false}
                height="auto"
                contentHeight={600}
                slotDuration="01:00:00"
                snapDuration="01:00:00"
              />
            ) : (
              <div className="h-[600px] flex items-center justify-center">
                <p className="text-muted-foreground">Unable to load calendar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={!!bookingModal && user.role !== "admin" && user.role !== "commander"}
        onOpenChange={() => setBookingModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>Review your reservation details</DialogDescription>
          </DialogHeader>

          {bookingModal && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Start Time</p>
                  <p className="text-base font-semibold">
                    {format(bookingModal.start, "MMM d, yyyy")}
                  </p>
                  <p className="text-base font-semibold">{format(bookingModal.start, "HH:mm")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">End Time</p>
                  <p className="text-base font-semibold">
                    {format(bookingModal.end, "MMM d, yyyy")}
                  </p>
                  <p className="text-base font-semibold">{format(bookingModal.end, "HH:mm")}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Duration</p>
                  <p className="text-base font-semibold">
                    {differenceInHours(bookingModal.end, bookingModal.start)} hours
                  </p>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm font-medium">Credits Required</p>
                  <p className="text-lg font-mono font-semibold">{creditsNeeded}</p>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm font-medium">Your Mess Credits</p>
                  <p className="text-lg font-mono font-semibold">{user.credits.toFixed(1)}</p>
                </div>
              </div>

              {loadingCapacity ? (
                <div className="border rounded-md p-4 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                </div>
              ) : (
                capacityInfo && (
                  <div
                    className={`border rounded-md p-4 ${
                      capacityInfo.isFull
                        ? "bg-destructive/5 border-destructive/50"
                        : capacityInfo.currentBookings >= 15
                          ? "bg-secondary/50 border-secondary"
                          : "bg-green-500/5 border-green-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users
                          className={`w-5 h-5 ${
                            capacityInfo.isFull
                              ? "text-destructive"
                              : capacityInfo.currentBookings >= 15
                                ? "text-secondary-foreground"
                                : "text-green-600 dark:text-green-400"
                          }`}
                        />
                        <p className="text-sm font-medium">Booking Capacity</p>
                      </div>
                      <Badge
                        variant={
                          capacityInfo.isFull
                            ? "destructive"
                            : capacityInfo.currentBookings >= 15
                              ? "secondary"
                              : "outline"
                        }
                        className={
                          !capacityInfo.isFull && capacityInfo.currentBookings < 15
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                            : ""
                        }
                        data-testid="badge-capacity"
                      >
                        {capacityInfo.availableSpots} / {capacityInfo.maxCapacity} available
                      </Badge>
                    </div>
                    {capacityInfo.isFull && (
                      <p className="text-sm text-destructive mt-2 font-medium">
                        This time slot is full. Please select a different time.
                      </p>
                    )}
                    {!capacityInfo.isFull && capacityInfo.currentBookings >= 15 && (
                      <p className="text-sm text-secondary-foreground mt-2 font-medium">
                        Limited availability - only {capacityInfo.availableSpots} spot
                        {capacityInfo.availableSpots !== 1 ? "s" : ""} remaining!
                      </p>
                    )}
                    {!capacityInfo.isFull && capacityInfo.currentBookings < 15 && (
                      <p className="text-sm text-green-700 dark:text-green-400 mt-2 font-medium">
                        Good availability - {capacityInfo.availableSpots} spot
                        {capacityInfo.availableSpots !== 1 ? "s" : ""} available
                      </p>
                    )}
                  </div>
                )
              )}

              {userAlreadyBooked && (
                <div className="border border-destructive/50 rounded-md p-3 bg-destructive/5">
                  <p className="text-sm text-destructive font-medium">
                    You already have a booking for this time slot.
                  </p>
                </div>
              )}

              {!hasEnoughCredits && (
                <div className="border border-destructive/50 rounded-md p-3 bg-destructive/5">
                  <p className="text-sm text-destructive font-medium">
                    Insufficient credits. You need {creditsNeeded} but only have{" "}
                    {user.credits.toFixed(1)}.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingModal(null)} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBooking}
              disabled={
                isCreating ||
                !hasEnoughCredits ||
                capacityInfo?.isFull ||
                loadingCapacity ||
                userAlreadyBooked
              }
              data-testid="button-confirm-booking"
            >
              {isCreating
                ? "Creating..."
                : userAlreadyBooked
                  ? "Already Booked"
                  : capacityInfo?.isFull
                    ? "Slot Full"
                    : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!eventModal} onOpenChange={() => setEventModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>Reservation information</DialogDescription>
          </DialogHeader>

          {eventModal && (
            <div className="space-y-4 py-4">
              {(user.role === "admin" || user.role === "commander") && eventModal.user && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Booked By</p>
                  <p className="text-base font-semibold">{eventModal.user.fullName}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Start Time</p>
                  <p className="text-base font-semibold">
                    {formatSingapore(eventModal.startTime, "MMM d, HH:mm")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">End Time</p>
                  <p className="text-base font-semibold">
                    {formatSingapore(eventModal.endTime, "MMM d, HH:mm")}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Credits Charged</p>
                <p className="text-lg font-mono font-semibold">
                  {eventModal.creditsCharged.toFixed(1)}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                <Badge variant="secondary" className="bg-green-500 text-green-950">
                  Active
                </Badge>
              </div>

              {(eventModal.userId === user.id || user.role === "admin") && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    {differenceInHours(new Date(eventModal.startTime), new Date()) > 24
                      ? "Cancelling will refund your credits"
                      : "Cancelling within 24 hours - no refund"}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {eventModal && (eventModal.userId === user.id || user.role === "admin") && (
              <Button
                variant="destructive"
                onClick={handleCancelBooking}
                disabled={isCancelling}
                data-testid="button-cancel-booking-modal"
              >
                {isCancelling ? "Cancelling..." : "Cancel Booking"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
