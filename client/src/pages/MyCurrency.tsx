import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDriveLogSchema, type QualificationWithStatus, type DriveLog, type SafeUser } from "@shared/schema";
import { z } from "zod";
import { CalendarDays, Car, Plus, Gauge, Award, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { useLocation } from "wouter";

const driveLogFormSchema = z.object({
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehicleNo: z.string().regex(/^\d{5}$/, "Vehicle number must be exactly 5 digits"),
  date: z.string().min(1, "Date is required"),
  initialMileageKm: z.number().min(0, "Initial mileage must be positive"),
  finalMileageKm: z.number().min(0, "Final mileage must be positive"),
  remarks: z.string().optional(),
}).refine((data) => data.finalMileageKm > data.initialMileageKm, {
  message: "Final mileage must be greater than initial mileage",
  path: ["finalMileageKm"],
});

export default function MyCurrency() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAddingLog, setIsAddingLog] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openLogDrive') === 'true') {
      setIsAddingLog(true);
      window.history.replaceState({}, '', '/my-currency');
    }
  }, []);

  const { data: user, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: qualifications, isLoading: qualificationsLoading } = useQuery<QualificationWithStatus[]>({
    queryKey: ["/api/qualifications/my"],
  });

  const { data: driveLogs, isLoading: logsLoading } = useQuery<DriveLog[]>({
    queryKey: ["/api/drive-logs/my"],
  });

  // For commanders, fetch all qualifications to show overview
  const { data: allQualifications = [] } = useQuery<QualificationWithStatus[]>({
    queryKey: ["/api/qualifications"],
    enabled: user?.role === "commander",
  });

  const form = useForm({
    resolver: zodResolver(driveLogFormSchema),
    defaultValues: {
      vehicleType: "",
      vehicleNo: "",
      date: new Date().toISOString().split('T')[0],
      initialMileageKm: "" as any,
      finalMileageKm: "" as any,
      remarks: "",
    },
  });

  // Auto-select vehicle type based on qualifications when dialog opens
  useEffect(() => {
    if (isAddingLog && qualifications && qualifications.length > 0) {
      const vehicleTypes = Array.from(new Set(qualifications.map(q => q.vehicleType)));
      if (vehicleTypes.length === 1) {
        // Only qualified for one vehicle - auto-select it
        form.setValue("vehicleType", vehicleTypes[0]);
      } else {
        // Qualified for multiple or none - reset to empty
        form.setValue("vehicleType", "");
      }
    }
  }, [isAddingLog, qualifications, form]);

  const createLogMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertDriveLogSchema>) => {
      return await apiRequest("POST", "/api/drive-logs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive-logs/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qualifications/my"] });
      toast({
        title: "Drive log submitted",
        description: "Your currency has been updated",
      });
      setIsAddingLog(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to submit drive log",
        description: error.message || "Please try again",
      });
    },
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const handleSubmitLog = (data: any) => {
    createLogMutation.mutate({
      ...data,
      userId: user.id,
      date: new Date(data.date),
    });
  };

  const getStatusBadge = (status: string, daysRemaining: number) => {
    if (status === "EXPIRED") {
      return (
        <Badge variant="destructive" className="gap-1" data-testid="badge-status-expired">
          <AlertTriangle className="w-3 h-3" />
          Expired
        </Badge>
      );
    } else if (status === "EXPIRING_SOON") {
      return (
        <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" data-testid="badge-status-expiring">
          <AlertTriangle className="w-3 h-3" />
          Expiring ({daysRemaining}d left)
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" data-testid="badge-status-current">
          <Award className="w-3 h-3" />
          Current ({daysRemaining}d left)
        </Badge>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="My Currency" />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Currency</h1>
              <p className="text-muted-foreground mt-1">View your driver qualifications and log drives</p>
            </div>
            <Button onClick={() => setIsAddingLog(true)} data-testid="button-add-drive-log">
              <Plus className="w-4 h-4 mr-2" />
              Log Drive
            </Button>
          </div>

          {/* {user.role === "commander" && allQualifications.length > 0 && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card data-testid="card-total-qualifications">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Qualifications</CardTitle>
                  <Award className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{allQualifications.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Company-wide</p>
                </CardContent>
              </Card>
              <Card data-testid="card-current-qualifications">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current</CardTitle>
                  <Award className="w-4 h-4 text-green-600 dark:text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {allQualifications.filter(q => q.status === "CURRENT").length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((allQualifications.filter(q => q.status === "CURRENT").length / allQualifications.length) * 100).toFixed(0)}% of total
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="card-expiring-qualifications">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {allQualifications.filter(q => q.status === "EXPIRING_SOON").length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((allQualifications.filter(q => q.status === "EXPIRING_SOON").length / allQualifications.length) * 100).toFixed(0)}% of total
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="card-expired-qualifications">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Expired</CardTitle>
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {allQualifications.filter(q => q.status === "EXPIRED").length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((allQualifications.filter(q => q.status === "EXPIRED").length / allQualifications.length) * 100).toFixed(0)}% of total
                  </p>
                </CardContent>
              </Card>
            </div>
          )} */}

        {qualificationsLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : qualifications && qualifications.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {qualifications.map((qual) => (
              <Card key={qual.id} data-testid={`card-qualification-${qual.vehicleType}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-xl">{qual.vehicleType}</CardTitle>
                  </div>
                  {getStatusBadge(qual.status, qual.daysRemaining)}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Qualified On</p>
                      <p className="font-medium" data-testid={`text-qualified-date-${qual.vehicleType}`}>
                        {format(new Date(qual.qualifiedOnDate), "dd MMM yyyy")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Drive</p>
                      <p className="font-medium" data-testid={`text-last-drive-${qual.vehicleType}`}>
                        {qual.lastDriveDate ? format(new Date(qual.lastDriveDate), "dd MMM yyyy") : "Never"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Currency Expires</p>
                      <p className="font-medium" data-testid={`text-expiry-date-${qual.vehicleType}`}>
                        {format(new Date(qual.currencyExpiryDate), "dd MMM yyyy")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Award className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No Qualifications</p>
              <p className="text-sm text-muted-foreground mt-1">Contact your admin to add vehicle qualifications</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Drive History</CardTitle>
            <CardDescription>Your recent drive logs</CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : driveLogs && driveLogs.length > 0 ? (
              <div className="space-y-2">
                {driveLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                    data-testid={`drive-log-${log.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                        <Gauge className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{log.vehicleType}</p>
                          <Badge variant="outline" className="text-xs">{log.vehicleNo}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(log.date), "dd MMM yyyy")} • {log.distanceKm.toFixed(1)} km
                        </p>
                        {log.remarks && (
                          <p className="text-xs text-muted-foreground mt-1">{log.remarks}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{log.initialMileageKm.toFixed(1)} → {log.finalMileageKm.toFixed(1)} km</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <CalendarDays className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No drive logs yet</p>
                <Button variant="outline" className="mt-4" onClick={() => setIsAddingLog(true)} data-testid="button-log-first-drive">
                  Log your first drive
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddingLog} onOpenChange={setIsAddingLog}>
          <DialogContent data-testid="dialog-add-drive-log">
            <DialogHeader>
              <DialogTitle>Log Drive</DialogTitle>
              <DialogDescription>
                Record your drive to maintain currency
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmitLog)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="vehicleType"
                  render={({ field }) => {
                    const qualifiedVehicles = qualifications ? Array.from(new Set(qualifications.map(q => q.vehicleType))) : [];
                    const isDisabled = createLogMutation.isPending || qualifiedVehicles.length === 1;
                    
                    return (
                      <FormItem>
                        <FormLabel>Vehicle Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isDisabled}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vehicle-type">
                              <SelectValue placeholder="Select vehicle type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {qualifiedVehicles.includes("TERREX" as any) && <SelectItem value="TERREX">Terrex</SelectItem>}
                            {qualifiedVehicles.includes("BELREX" as any) && <SelectItem value="BELREX">Belrex</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="vehicleNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle No. (MID)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="12345 (5 digits)"
                          disabled={createLogMutation.isPending}
                          maxLength={5}
                          data-testid="input-vehicle-no"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Drive</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          disabled={createLogMutation.isPending}
                          data-testid="input-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="initialMileageKm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Mileage (KM)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            disabled={createLogMutation.isPending}
                            value={field.value === 0 || field.value === "" ? "" : field.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val === "" ? "" : parseFloat(val) || "");
                            }}
                            data-testid="input-initial-mileage"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="finalMileageKm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Final Mileage (KM)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            disabled={createLogMutation.isPending}
                            value={field.value === 0 || field.value === "" ? "" : field.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val === "" ? "" : parseFloat(val) || "");
                            }}
                            data-testid="input-final-mileage"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="Any additional notes..."
                          disabled={createLogMutation.isPending}
                          data-testid="input-remarks"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddingLog(false)}
                    disabled={createLogMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createLogMutation.isPending} data-testid="button-submit-drive-log">
                    {createLogMutation.isPending ? "Submitting..." : "Submit"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}
