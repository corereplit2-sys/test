import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { BookableWeekRange } from "@shared/schema";
import { Calendar, Info, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function AdminSettings() {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [defaultCredits, setDefaultCredits] = useState<number>(10);

  const { data: scheduleConfig, isLoading: scheduleLoading } = useQuery<BookableWeekRange>({
    queryKey: ["/api/config/booking-release-day"],
  });

  const { data: creditsConfig, isLoading: creditsLoading } = useQuery<{ defaultCredits: number }>({
    queryKey: ["/api/config/default-credits"],
  });

  useEffect(() => {
    if (creditsConfig) {
      setDefaultCredits(creditsConfig.defaultCredits);
    }
  }, [creditsConfig]);

  const updateScheduleMutation = useMutation({
    mutationFn: async (releaseDay: number) => {
      return await apiRequest("PUT", "/api/config/booking-release-day", { releaseDay });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/booking-release-day"] });
      toast({
        title: "Schedule updated",
        description: "Booking release day has been updated successfully.",
      });
      setSelectedDay("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update schedule",
      });
    },
  });

  const updateCreditsMutation = useMutation({
    mutationFn: async (credits: number) => {
      return await apiRequest("PUT", "/api/config/default-credits", { defaultCredits: credits });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/default-credits"] });
      toast({
        title: "Settings updated",
        description: "Default weekly credits has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update default credits",
      });
    },
  });

  const handleUpdateSchedule = () => {
    if (selectedDay === "") return;
    updateScheduleMutation.mutate(parseInt(selectedDay));
  };

  const handleUpdateCredits = () => {
    if (defaultCredits < 0) return;
    updateCreditsMutation.mutate(defaultCredits);
  };

  if (scheduleLoading || creditsLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentDayLabel = DAYS_OF_WEEK.find(d => d.value === scheduleConfig?.releaseDay.toString())?.label || "Not set";

  return (
    <div className="space-y-6">
      {/* Weekly Credits Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <CardTitle>Default Weekly Credits</CardTitle>
          </div>
          <CardDescription>
            Configure the number of credits soldiers receive automatically each week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border rounded-md p-4 bg-accent/50">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Automatic Weekly Reset</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Soldiers' credits automatically reset when a new bookable week starts</li>
                  <li>This happens based on the release day configured below</li>
                  <li>Example: If release day is Sunday, credits reset every Sunday at midnight</li>
                  <li>No manual intervention required - the system handles it automatically</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="default-credits" className="text-sm font-medium mb-2">
                Default Credits Per Week
              </Label>
              <Input
                id="default-credits"
                type="number"
                min="0"
                step="0.5"
                value={defaultCredits}
                onChange={(e) => setDefaultCredits(parseFloat(e.target.value) || 0)}
                className="max-w-xs"
                data-testid="input-default-credits"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Each soldier will automatically receive this many credits when the week resets
              </p>
            </div>

            <Button
              onClick={handleUpdateCredits}
              disabled={defaultCredits < 0 || updateCreditsMutation.isPending}
              data-testid="button-save-credits"
            >
              {updateCreditsMutation.isPending ? "Saving..." : "Save Default Credits"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Booking Release Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle>Booking Release Schedule</CardTitle>
          </div>
          <CardDescription>
            Configure when the next week's bookings become visible to soldiers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border rounded-md p-4 bg-accent/50">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">How it works</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Soldiers can only view one week of bookings at a time</li>
                  <li>The week becomes visible starting on the configured day</li>
                  <li>Example: If set to Sunday, the next week becomes visible every Sunday</li>
                  <li>Credits also reset automatically on this day</li>
                </ul>
              </div>
            </div>
          </div>

          {scheduleConfig && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Current Release Day</p>
                <Badge variant="default" className="text-base px-4 py-2" data-testid="badge-current-release-day">
                  {currentDayLabel}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Currently Visible Week</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">
                    {format(new Date(scheduleConfig.start), "MMM d, yyyy")}
                  </span>
                  <span>→</span>
                  <span className="font-mono">
                    {format(new Date(scheduleConfig.end), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <p className="text-sm font-medium mb-3">Update Release Day</p>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger data-testid="select-release-day">
                    <SelectValue placeholder="Select day of week" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleUpdateSchedule}
                disabled={selectedDay === "" || updateScheduleMutation.isPending}
                data-testid="button-update-schedule"
              >
                {updateScheduleMutation.isPending ? "Updating..." : "Update Schedule"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
