import { useQuery } from "@tanstack/react-query";
import { SafeUser, BookingWithUser, CapacityInfo, BookableWeekRange } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminBookings } from "@/components/admin/AdminBookings";
import { AdminUserCredits } from "@/components/admin/AdminUserCredits";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { MessRulesModal } from "@/components/MessRulesModal";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, differenceInHours, differenceInMinutes, addHours, addDays, startOfDay, eachHourOfInterval } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, X, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MessBooking() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const calendarRef = useRef<FullCalendar>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(true);
  const [rulesAgreed, setRulesAgreed] = useState(false);
  const [bookingModal, setBookingModal] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [eventModal, setEventModal] = useState<BookingWithUser | null>(null);
  const [timeslotDetailsModal, setTimeslotDetailsModal] = useState<{ startTime: Date; endTime: Date } | null>(null);
  const [timeslotBookings, setTimeslotBookings] = useState<BookingWithUser[]>([]);
  const [loadingTimeslotDetails, setLoadingTimeslotDetails] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [capacityInfo, setCapacityInfo] = useState<CapacityInfo | null>(null);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [capacityBackgrounds, setCapacityBackgrounds] = useState<any[]>([]);

  const { data: user, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: allBookings = [], refetch: refetchAllBookings } = useQuery<BookingWithUser[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: calendarEvents = [], refetch: refetchEvents } = useQuery<any[]>({
    queryKey: ["/api/bookings/calendar-events"],
  });

  const { data: bookableWeek, isLoading: weekLoading } = useQuery<BookableWeekRange>({
    queryKey: ["/api/config/booking-release-day"],
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-16">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const events = useMemo(() => [
    ...calendarEvents.map(event => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      backgroundColor: user.role === "admin" ? "#a855f7" : "#3b82f6",
      borderColor: user.role === "admin" ? "#9333ea" : "#2563eb",
      extendedProps: {
        calendarEvent: event,
        isAdmin: user.role === "admin",
      },
    })),
    ...capacityBackgrounds
  ], [calendarEvents, capacityBackgrounds, user]);

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

  const creditsNeeded = bookingModal
    ? Math.ceil(differenceInHours(bookingModal.end, bookingModal.start))
    : 0;
  const hasEnoughCredits = creditsNeeded <= user.credits;

  // Check if user already has a booking for this time slot
  const userAlreadyBooked = bookingModal
    ? allBookings
        .filter(b => b.status === "active" && b.userId === user.id)
        .some(booking => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          // Check overlap: booking.start < new.end AND booking.end > new.start
          return bookingStart < bookingModal.end && bookingEnd > bookingModal.start;
        })
    : false;

  const generateCapacityBackgrounds = useCallback((start: Date, end: Date) => {
    try {
      const hours = eachHourOfInterval({ start, end });
      
      const backgroundEvents = hours
        .filter(hourStart => {
          const hourOfDay = hourStart.getHours();
          return hourOfDay >= 6 && hourOfDay < 22;
        })
        .map(hourStart => {
          const hourEnd = addHours(hourStart, 1);
          
          const currentBookings = allBookings.filter(booking => {
            if (booking.status !== 'active') return false;
            const bookingStart = new Date(booking.startTime);
            const bookingEnd = new Date(booking.endTime);
            return bookingStart < hourEnd && bookingEnd > hourStart;
          }).length;

          let backgroundColor = '';
          let borderColor = '';
          
          if (currentBookings >= 20) {
            backgroundColor = 'rgba(239, 68, 68, 0.6)';
            borderColor = 'rgba(239, 68, 68, 0.9)';
          } else if (currentBookings >= 15) {
            backgroundColor = 'rgba(234, 179, 8, 0.6)';
            borderColor = 'rgba(234, 179, 8, 0.9)';
          } else {
            backgroundColor = 'rgba(34, 197, 94, 0.6)';
            borderColor = 'rgba(34, 197, 94, 0.9)';
          }

          return {
            id: `capacity-${hourStart.toISOString()}`,
            start: hourStart,
            end: hourEnd,
            display: 'background',
            backgroundColor,
            borderColor,
          };
        });

      setCapacityBackgrounds(backgroundEvents);
    } catch (error) {
      console.error("Failed to generate capacity backgrounds:", error);
    }
  }, [allBookings]);

  useEffect(() => {
    if (bookableWeek) {
      const start = new Date(bookableWeek.start);
      const end = new Date(bookableWeek.end);
      generateCapacityBackgrounds(start, end);
    }
  }, [allBookings, bookableWeek, generateCapacityBackgrounds]);

  useEffect(() => {
    // Show rules modal for soldiers on page load
    if (user?.role === "soldier") {
      console.log("Setting rules modal to show for soldier");
      setShowRulesModal(true);
      setRulesAgreed(false);
    }
  }, [user?.id, user?.role]);


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
    const { calendarEvent, isAdmin } = clickInfo.event.extendedProps || {};
    
    if (isAdmin) {
      // Admin clicked an aggregated event - show timeslot details
      const start = new Date(clickInfo.event.start);
      const end = new Date(clickInfo.event.end);
      setTimeslotDetailsModal({ startTime: start, endTime: end });
    } else {
      // Soldier clicked their own booking - show individual booking details
      if (calendarEvent?.bookingId) {
        const booking = allBookings.find(b => b.id === calendarEvent.bookingId);
        if (booking) {
          setEventModal(booking);
        }
      }
    }
  };

  // Fetch timeslot details for admin
  useEffect(() => {
    if (timeslotDetailsModal) {
      const fetchTimeslotDetails = async () => {
        setLoadingTimeslotDetails(true);
        try {
          const params = new URLSearchParams({
            startTime: timeslotDetailsModal.startTime.toISOString(),
            endTime: timeslotDetailsModal.endTime.toISOString(),
          });
          const response = await fetch(`/api/bookings/timeslot-details?${params}`);
          const data = await response.json();
          setTimeslotBookings(data);
        } catch (error) {
          console.error("Failed to fetch timeslot details:", error);
          setTimeslotBookings([]);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load booking details",
          });
        } finally {
          setLoadingTimeslotDetails(false);
        }
      };
      fetchTimeslotDetails();
    } else {
      setTimeslotBookings([]);
    }
  }, [timeslotDetailsModal, toast]);

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
        description: `Successfully booked for ${creditsNeeded} hour${creditsNeeded > 1 ? 's' : ''}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      refetchAllBookings();
      refetchEvents();
      setBookingModal(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to create booking",
        description: error.message || "Please try again",
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
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      refetchAllBookings();
      refetchEvents();
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

  const handleRulesAgree = () => {
    setRulesAgreed(true);
    setShowRulesModal(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="Mess Booking" />
      
      {user.role === "soldier" && <MessRulesModal open={showRulesModal && !rulesAgreed} onAgree={handleRulesAgree} />}
      
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">
              {user.role === "soldier" ? "Mess Booking" : "Mess Booking Management"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {user.role === "soldier" 
                ? "Book your time slots at the Mess" 
                : "Manage bookings, credits, and schedule configuration"}
            </p>
          </div>

          <Tabs defaultValue="calendar" className="space-y-6">
            <TabsList className={
              user.role === "admin" 
                ? "grid w-full grid-cols-4 max-w-3xl" 
                : user.role === "commander"
                ? "grid w-full grid-cols-3 max-w-2xl"
                : "grid w-full grid-cols-2 max-w-lg"
            }>
              <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
              {(user.role === "admin" || user.role === "commander") && <TabsTrigger value="bookings" data-testid="tab-bookings">Bookings</TabsTrigger>}
              {(user.role === "admin" || user.role === "commander") && <TabsTrigger value="credits" data-testid="tab-credits">Credits</TabsTrigger>}
              {user.role === "admin" && <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>}
              {user.role === "soldier" && <TabsTrigger value="bookings" data-testid="tab-my-bookings">My Bookings</TabsTrigger>}
            </TabsList>

            <TabsContent value="calendar">
              <div className="space-y-4">
                {user.role === "soldier" && showInstructions && (
                  <div className="mb-6 border rounded-md p-4 bg-accent/50 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">How to book</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Click on any 1-hour time slot to book it. Click on existing bookings to view details or cancel.
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
                      <div className="w-4 h-4 rounded border-2" style={{ backgroundColor: 'rgba(34, 197, 94, 0.6)', borderColor: 'rgba(34, 197, 94, 0.9)' }}></div>
                      <span>Good (&lt;15)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded border-2" style={{ backgroundColor: 'rgba(234, 179, 8, 0.6)', borderColor: 'rgba(234, 179, 8, 0.9)' }}></div>
                      <span>Limited (15-19)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded border-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)', borderColor: 'rgba(239, 68, 68, 0.9)' }}></div>
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
                        const hours = date.date.hour.toString().padStart(2, '0');
                        const minutes = date.date.minute.toString().padStart(2, '0');
                        return `${hours}${minutes}`;
                      }}
                      eventTimeFormat={(date) => {
                        const hours = date.date.hour.toString().padStart(2, '0');
                        const minutes = date.date.minute.toString().padStart(2, '0');
                        return `${hours}${minutes}`;
                      }}
                      headerToolbar={{
                        left: "",
                        center: "title",
                        right: "",
                      }}
                      validRange={{
                        start: bookableWeek.start,
                        end: startOfDay(addDays(new Date(bookableWeek.end), 1)),
                      }}
                      editable={false}
                      selectable={false}
                      dayMaxEvents={true}
                      weekends={true}
                      events={events}
                      dateClick={user.role === "soldier" ? handleDateClick : undefined}
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

                {user.role === "soldier" && (
                  <div className="border rounded-md p-4 bg-muted/50 mt-4">
                    <h4 className="text-sm font-medium mb-3 uppercase tracking-wide">
                      Booking Rules
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>1 credit = 1 hour of booking</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Maximum 20 people per time slot</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Cancel &gt;24h before: full refund</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Cancel ≤24h before: no refund</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </TabsContent>

            {user.role === "admin" && (
              <>
                <TabsContent value="bookings">
                  <AdminBookings />
                </TabsContent>

                <TabsContent value="credits">
                  <AdminUserCredits />
                </TabsContent>

                <TabsContent value="settings">
                  <AdminSettings />
                </TabsContent>
              </>
            )}

            {user.role === "commander" && (
              <>
                <TabsContent value="bookings">
                  <AdminBookings />
                </TabsContent>

                <TabsContent value="credits">
                  <AdminUserCredits />
                </TabsContent>
              </>
            )}

            {user.role === "soldier" && (
              <TabsContent value="bookings">
                <div className="space-y-4">
                  {allBookings.filter(b => b.userId === user.id && b.status === "active").length > 0 ? (
                    allBookings
                      .filter((b: BookingWithUser) => b.userId === user.id && b.status === "active")
                      .sort((a: BookingWithUser, b: BookingWithUser) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                      .map((booking: BookingWithUser) => (
                        <div 
                          key={booking.id} 
                          className="border rounded-md p-4 hover-elevate cursor-pointer"
                          onClick={() => setEventModal(booking)}
                          data-testid={`booking-card-${booking.id}`}
                        >
                          <div>
                            <p className="font-medium">{format(new Date(booking.startTime), "EEEE, MMMM d, yyyy")}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(booking.startTime), "h:mm a")} - {format(new Date(booking.endTime), "h:mm a")}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {booking.creditsCharged} credit{booking.creditsCharged !== 1 ? 's' : ''} charged
                            </p>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No active bookings</p>
                      <p className="text-sm mt-1">Click the Calendar tab to create a booking</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <Dialog open={!!bookingModal && user.role === "soldier"} onOpenChange={() => setBookingModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              Review your reservation details
            </DialogDescription>
          </DialogHeader>

          {bookingModal && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Start Time</p>
                  <p className="text-base font-semibold">
                    {format(bookingModal.start, "MMM d, yyyy")}
                  </p>
                  <p className="text-base font-semibold">
                    {format(bookingModal.start, "HH:mm")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">End Time</p>
                  <p className="text-base font-semibold">
                    {format(bookingModal.end, "MMM d, yyyy")}
                  </p>
                  <p className="text-base font-semibold">
                    {format(bookingModal.end, "HH:mm")}
                  </p>
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
              ) : capacityInfo && (
                <div className={`border rounded-md p-4 ${
                  capacityInfo.isFull 
                    ? 'bg-destructive/5 border-destructive/50' 
                    : capacityInfo.currentBookings >= 15
                    ? 'bg-secondary/50 border-secondary'
                    : 'bg-green-500/5 border-green-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className={`w-5 h-5 ${
                        capacityInfo.isFull 
                          ? 'text-destructive' 
                          : capacityInfo.currentBookings >= 15
                          ? 'text-secondary-foreground'
                          : 'text-green-600 dark:text-green-400'
                      }`} />
                      <p className="text-sm font-medium">
                        Booking Capacity
                      </p>
                    </div>
                    <Badge 
                      variant={
                        capacityInfo.isFull 
                          ? 'destructive' 
                          : capacityInfo.currentBookings >= 15
                          ? 'secondary'
                          : 'outline'
                      }
                      className={
                        !capacityInfo.isFull && capacityInfo.currentBookings < 15
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                          : ''
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
                      Limited availability - only {capacityInfo.availableSpots} spot{capacityInfo.availableSpots !== 1 ? 's' : ''} remaining!
                    </p>
                  )}
                  {!capacityInfo.isFull && capacityInfo.currentBookings < 15 && (
                    <p className="text-sm text-green-700 dark:text-green-400 mt-2 font-medium">
                      Good availability - {capacityInfo.availableSpots} spot{capacityInfo.availableSpots !== 1 ? 's' : ''} available
                    </p>
                  )}
                </div>
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
                    Insufficient credits. You need {creditsNeeded} credits but only have {user.credits.toFixed(1)}.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBookingModal(null)}
              disabled={isCreating}
              data-testid="button-cancel-booking-modal"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBooking}
              disabled={isCreating || !hasEnoughCredits || (capacityInfo?.isFull) || userAlreadyBooked}
              data-testid="button-confirm-booking"
            >
              {isCreating ? "Creating..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!eventModal} onOpenChange={() => setEventModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              View and manage your booking
            </DialogDescription>
          </DialogHeader>
          {eventModal && (
            <div className="space-y-4">
              {user.role === "admin" && eventModal.user && (
                <div>
                  <p className="text-sm font-medium">Booked By</p>
                  <p className="text-sm text-muted-foreground">{eventModal.user.fullName}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">Time Slot</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(eventModal.startTime), "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(eventModal.startTime), "h:mm a")} - {format(new Date(eventModal.endTime), "h:mm a")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Credits Charged</p>
                <p className="text-sm text-muted-foreground">{eventModal.creditsCharged} credits</p>
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge variant={eventModal.status === "active" ? "default" : "secondary"}>
                  {eventModal.status}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventModal(null)}>
              Close
            </Button>
            {eventModal && eventModal.userId === user.id && eventModal.status === "active" && (
              <Button variant="destructive" onClick={handleCancelBooking} disabled={isCancelling}>
                {isCancelling ? "Cancelling..." : "Cancel Booking"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!timeslotDetailsModal} onOpenChange={() => setTimeslotDetailsModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Timeslot Bookings</DialogTitle>
            <DialogDescription>
              {timeslotDetailsModal && (
                <>
                  {format(new Date(timeslotDetailsModal.startTime), "EEEE, MMMM d, yyyy")} • {" "}
                  {format(new Date(timeslotDetailsModal.startTime), "HHmm")} - {format(new Date(timeslotDetailsModal.endTime), "HHmm")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {loadingTimeslotDetails ? (
            <div className="py-8 text-center text-muted-foreground">Loading bookings...</div>
          ) : timeslotBookings.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {timeslotBookings.map((booking: BookingWithUser) => (
                <div key={booking.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{booking.user?.fullName || "Unknown"}</p>
                    {booking.user?.rank && (
                      <p className="text-sm text-muted-foreground">{booking.user.rank}</p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (confirm(`Cancel booking for ${booking.user?.fullName}?`)) {
                        try {
                          await apiRequest("POST", `/api/bookings/${booking.id}/cancel`);
                          toast({
                            title: "Booking cancelled",
                            description: "The booking has been cancelled successfully",
                          });
                          queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/bookings/calendar-events"] });
                          refetchAllBookings();
                          refetchEvents();
                          setTimeslotDetailsModal(prev => prev ? {...prev} : null);
                        } catch (error: any) {
                          toast({
                            variant: "destructive",
                            title: "Failed to cancel",
                            description: error.message || "Please try again",
                          });
                        }
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No bookings for this timeslot</div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeslotDetailsModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
