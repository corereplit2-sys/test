import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDriverQualificationSchema, insertDriveLogSchema, type QualificationWithStatus, type DriveLog, type SafeUser, type Msp } from "@shared/schema";
import { z } from "zod";
import { Car, Plus, Search, AlertTriangle, Award, Trash2, Gauge, X, ArrowLeft, Upload, QrCode } from "lucide-react";
import { QRScanner } from "@/components/soldier/QRScanner";
import { AdminCurrencyDrives } from "@/components/admin/AdminCurrencyDrives";
import { format } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type FilterTag = {
  id: string;
  type: "msp" | "vehicle" | "status";
  label: string;
  value: string;
};

export default function CurrencyTracker() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qualificationsCardRef = useRef<HTMLDivElement>(null);
  
  // Read status filter from URL on mount
  const params = new URLSearchParams(window.location.search);
  const initialStatus = params.get("status") || "all";
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTags, setFilterTags] = useState<FilterTag[]>([]);
  const [isAddingQual, setIsAddingQual] = useState(false);
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [selectedQual, setSelectedQual] = useState<QualificationWithStatus | null>(null);
  const [deletingLog, setDeletingLog] = useState<DriveLog | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchImportData, setBatchImportData] = useState("");
  const [importResults, setImportResults] = useState<any>(null);

  const { data: user, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: qualifications = [], isLoading: qualificationsLoading } = useQuery<QualificationWithStatus[]>({
    queryKey: ["/api/qualifications"],
  });

  const { data: allDriveLogs = [], isLoading: logsLoading } = useQuery<DriveLog[]>({
    queryKey: ["/api/drive-logs"],
  });

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: msps = [] } = useQuery<Msp[]>({
    queryKey: ["/api/msps"],
  });

  const vehicleTypes = ["TERREX", "BELREX"];
  const statusTypes = [
    { value: "CURRENT", label: "Current" },
    { value: "EXPIRING_SOON", label: "Expiring Soon" },
    { value: "EXPIRED", label: "Expired" }
  ];

  const addFilterTag = (type: "msp" | "vehicle" | "status", value: string, label: string) => {
    const id = `${type}-${value}`;
    // Clear all filters and add only the new one (single-select behavior)
    setFilterTags([{ id, type, label, value }]);
    setShowFilterPopover(false);
    
    // Auto-scroll to qualifications card
    setTimeout(() => {
      qualificationsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const removeFilterTag = (id: string) => {
    setFilterTags(filterTags.filter(tag => tag.id !== id));
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    
    // Auto-detect and create filter tags from search input
    const upperValue = value.toUpperCase().trim();
    
    // Check for MSP match
    const mspMatch = msps.find(msp => msp.name.toUpperCase() === upperValue);
    if (mspMatch) {
      addFilterTag("msp", mspMatch.id, mspMatch.name);
      setSearchTerm("");
      return;
    }
    
    // Check for vehicle type match
    const vehicleMatch = vehicleTypes.find(vehicle => vehicle === upperValue);
    if (vehicleMatch) {
      addFilterTag("vehicle", vehicleMatch, vehicleMatch);
      setSearchTerm("");
      return;
    }
  };

  const qualForm = useForm({
    resolver: zodResolver(insertDriverQualificationSchema),
    defaultValues: {
      userId: "",
      vehicleType: "",
      qualifiedOnDate: new Date().toISOString().split('T')[0],
    },
  });

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

  const driveLogForm = useForm({
    resolver: zodResolver(driveLogFormSchema),
    defaultValues: {
      vehicleType: selectedQual?.vehicleType || "",
      vehicleNo: "",
      date: new Date().toISOString().split('T')[0],
      initialMileageKm: "" as any,
      finalMileageKm: "" as any,
      remarks: "",
    },
  });

  const createQualMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertDriverQualificationSchema>) => {
      return await apiRequest("POST", "/api/qualifications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualifications"] });
      toast({
        title: "Qualification added",
        description: "Driver qualification has been created successfully",
      });
      setIsAddingQual(false);
      qualForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to add qualification",
        description: error.message || "Please try again",
      });
    },
  });

  const createLogMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertDriveLogSchema>) => {
      return await apiRequest("POST", "/api/drive-logs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qualifications"] });
      toast({
        title: "Drive log added",
        description: "Currency has been updated",
      });
      setIsAddingLog(false);
      driveLogForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to add drive log",
        description: error.message || "Please try again",
      });
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (logId: string) => {
      return await apiRequest("DELETE", `/api/drive-logs/${logId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qualifications"] });
      toast({
        title: "Drive log deleted",
        description: "Currency has been recalculated",
      });
      setDeletingLog(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete drive log",
        description: error.message || "Please try again",
      });
    },
  });

  const batchImportMutation = useMutation({
    mutationFn: async (data: string) => {
      return await apiRequest("POST", "/api/qualifications/batch-import", { data });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualifications"] });
      setImportResults(response.results);
      toast({
        title: "Batch import complete",
        description: response.message,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Batch import failed",
        description: error.message || "Please try again",
      });
    },
  });

  const handleBatchImport = () => {
    if (!batchImportData.trim()) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "Please paste the qualification data",
      });
      return;
    }
    batchImportMutation.mutate(batchImportData);
  };

  const closeBatchImport = () => {
    setShowBatchImport(false);
    setBatchImportData("");
    setImportResults(null);
  };

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

  if (!user || (user.role !== "admin" && user.role !== "commander")) {
    setLocation("/login");
    return null;
  }

  const filteredQualifications = qualifications.filter(qual => {
    const matchesSearch = searchTerm === "" ||
                          qual.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          qual.user?.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const mspTags = filterTags.filter(t => t.type === "msp");
    const vehicleTags = filterTags.filter(t => t.type === "vehicle");
    const statusTags = filterTags.filter(t => t.type === "status");
    
    const matchesMsp = mspTags.length === 0 || mspTags.some(tag => qual.user?.mspId === tag.value);
    const matchesVehicleType = vehicleTags.length === 0 || vehicleTags.some(tag => qual.vehicleType === tag.value);
    const matchesStatus = statusTags.length === 0 || statusTags.some(tag => qual.status === tag.value);
    
    return matchesSearch && matchesMsp && matchesVehicleType && matchesStatus;
  });

  const selectedQualLogs = selectedQual
    ? allDriveLogs.filter(log =>
        log.userId === selectedQual.userId && log.vehicleType === selectedQual.vehicleType
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

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
          Expiring ({daysRemaining}d)
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" data-testid="badge-status-current">
          <Award className="w-3 h-3" />
          Current ({daysRemaining}d)
        </Badge>
      );
    }
  };

  const handleSubmitQual = (data: any) => {
    const qualData = {
      ...data,
      qualifiedOnDate: new Date(data.qualifiedOnDate),
    };
    createQualMutation.mutate(qualData);
  };

  const handleSubmitLog = (data: any) => {
    if (!selectedQual) return;
    const fullData = {
      ...data,
      userId: selectedQual.userId,
      vehicleType: selectedQual.vehicleType,
    };
    createLogMutation.mutate(fullData);
  };

  const handleDeleteLog = () => {
    if (!deletingLog) return;
    deleteLogMutation.mutate(deletingLog.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="Currency Tracker" />
      
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {selectedQual ? (
            <div className="mb-6">
              <Button 
                variant="ghost" 
                onClick={() => setSelectedQual(null)}
                data-testid="button-back-to-qualifications"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to All Qualifications
              </Button>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Currency Tracker</h1>
                <p className="text-muted-foreground mt-1 text-sm">Company-wide driver currency management</p>
              </div>
              {user?.role === "admin" && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => setShowBatchImport(true)} data-testid="button-batch-import" size="sm" className="md:size-auto">
                    <Upload className="w-4 h-4 mr-2" />
                    Batch Import
                  </Button>
                  <Button onClick={() => setIsAddingQual(true)} data-testid="button-add-qualification" size="sm" className="md:size-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Qualification
                  </Button>
                </div>
              )}
            </div>
          )}

          {!selectedQual && (
            <>
              <div className="grid gap-2 grid-cols-2 md:grid-cols-4 mb-6">
                <Card data-testid="card-analytics-total">
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">Total Qualifications</CardTitle>
                    <Award className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">{qualifications.length}</div>
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">Across all MSPs</p>
                  </CardContent>
                </Card>
                <Card 
                  data-testid="card-analytics-current"
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => addFilterTag("status", "CURRENT", "Current")}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">Current</CardTitle>
                    <Award className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">
                      {qualifications.filter(q => q.status === "CURRENT").length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                      {qualifications.length > 0 
                        ? `${((qualifications.filter(q => q.status === "CURRENT").length / qualifications.length) * 100).toFixed(0)}% of total`
                        : "0%"
                      }
                    </p>
                  </CardContent>
                </Card>
                <Card 
                  data-testid="card-analytics-expiring"
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => addFilterTag("status", "EXPIRING_SOON", "Expiring Soon")}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">Expiring Soon</CardTitle>
                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">
                      {qualifications.filter(q => q.status === "EXPIRING_SOON").length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                      {qualifications.length > 0
                        ? `${((qualifications.filter(q => q.status === "EXPIRING_SOON").length / qualifications.length) * 100).toFixed(0)}% of total`
                        : "0%"
                      }
                    </p>
                  </CardContent>
                </Card>
                <Card 
                  data-testid="card-analytics-expired"
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => addFilterTag("status", "EXPIRED", "Expired")}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">Expired</CardTitle>
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">
                      {qualifications.filter(q => q.status === "EXPIRED").length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                      {qualifications.length > 0
                        ? `${((qualifications.filter(q => q.status === "EXPIRED").length / qualifications.length) * 100).toFixed(0)}% of total`
                        : "0%"
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* QR Scanner for Soldiers */}
              {user?.role === "soldier" && (
                <div className="mb-6">
                  <QRScanner />
                </div>
              )}

              {/* Admin QR Code Manager */}
              {user?.role === "admin" && (
                <div className="mb-6">
                  <AdminCurrencyDrives />
                </div>
              )}

              <div className="grid gap-6 mb-6">
                <Card data-testid="card-msp-breakdown">
                  <CardHeader>
                    <CardTitle>MSP Breakdown</CardTitle>
                    <CardDescription>Currency status by MSP</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {msps.map(msp => {
                        const mspQuals = qualifications.filter(q => q.user?.mspId === msp.id);
                        const current = mspQuals.filter(q => q.status === "CURRENT").length;
                        const expiring = mspQuals.filter(q => q.status === "EXPIRING_SOON").length;
                        const expired = mspQuals.filter(q => q.status === "EXPIRED").length;
                        
                        return (
                          <div 
                            key={msp.id} 
                            className="flex items-center justify-between border rounded-md p-3 cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => addFilterTag("msp", msp.id, msp.name)}
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">{msp.name}</p>
                              <p className="text-xs text-muted-foreground">Total: {mspQuals.length}</p>
                            </div>
                            <div className="flex gap-2 text-xs font-medium">
                              <span className="text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded">{current}</span>
                              <span className="text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">{expiring}</span>
                              <span className="text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-1 rounded">{expired}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-vehicle-breakdown">
                  <CardHeader>
                    <CardTitle>Vehicle Type Breakdown</CardTitle>
                    <CardDescription>Currency status by vehicle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {vehicleTypes.map(vehicle => {
                        const vehicleQuals = qualifications.filter(q => q.vehicleType === vehicle);
                        const current = vehicleQuals.filter(q => q.status === "CURRENT").length;
                        const expiring = vehicleQuals.filter(q => q.status === "EXPIRING_SOON").length;
                        const expired = vehicleQuals.filter(q => q.status === "EXPIRED").length;
                        
                        return (
                          <div 
                            key={vehicle} 
                            className="flex items-center justify-between border rounded-md p-3 cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => addFilterTag("vehicle", vehicle, vehicle)}
                          >
                            <div className="flex-1 flex items-center gap-2">
                              <Car className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{vehicle}</p>
                                <p className="text-xs text-muted-foreground">Total: {vehicleQuals.length}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 text-xs font-medium">
                              <span className="text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded">{current}</span>
                              <span className="text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">{expiring}</span>
                              <span className="text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-1 rounded">{expired}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or type filter (e.g., HQ, MSP 1, TERREX)..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-name"
                    />
                  </div>
                  <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" data-testid="button-add-filter">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Filter
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="end">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-2">MSP</p>
                          <div className="space-y-1">
                            {msps.map(msp => (
                              <Button
                                key={msp.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => addFilterTag("msp", msp.id, msp.name)}
                                data-testid={`filter-msp-${msp.id}`}
                              >
                                {msp.name}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Vehicle Type</p>
                          <div className="space-y-1">
                            {vehicleTypes.map(vehicle => (
                              <Button
                                key={vehicle}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2"
                                onClick={() => addFilterTag("vehicle", vehicle, vehicle)}
                                data-testid={`filter-vehicle-${vehicle}`}
                              >
                                <Car className="w-3 h-3" />
                                {vehicle}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Status</p>
                          <div className="space-y-1">
                            {statusTypes.map(status => (
                              <Button
                                key={status.value}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => addFilterTag("status", status.value, status.label)}
                                data-testid={`filter-status-${status.value}`}
                              >
                                {status.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {filterTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {filterTags.map(tag => (
                      <Badge key={tag.id} variant="secondary" className="gap-1" data-testid={`tag-${tag.id}`}>
                        {tag.type === "vehicle" && <Car className="w-3 h-3" />}
                        {tag.label}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => removeFilterTag(tag.id)}
                          data-testid={`remove-tag-${tag.id}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3" ref={qualificationsCardRef}>
              <Card>
                <CardHeader>
                  <CardTitle>All Qualifications</CardTitle>
                  <CardDescription>
                    {filteredQualifications.length} qualification{filteredQualifications.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {qualificationsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : filteredQualifications.length > 0 ? (
                    <>
                      {/* Mobile Card View */}
                      <div className="space-y-3 md:hidden">
                        {filteredQualifications.map((qual) => (
                          <div
                            key={qual.id}
                            className="border rounded-md p-4 cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => setSelectedQual(qual)}
                            data-testid={`card-qualification-${qual.id}`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1">
                                <p className="font-semibold text-base">{qual.user?.fullName || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">{qual.user?.rank || "-"}</p>
                              </div>
                              <div>
                                {getStatusBadge(qual.status, qual.daysRemaining)}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">MSP</p>
                                <p className="font-medium text-xs">{msps.find(m => m.id === qual.user?.mspId)?.name || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Vehicle</p>
                                <p className="font-medium text-xs">{qual.vehicleType}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-xs text-muted-foreground">Last Drive</p>
                                <p className="font-medium text-xs">
                                  {qual.lastDriveDate ? format(new Date(qual.lastDriveDate), "dd MMM yyyy") : "Never"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block border rounded-md">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">User</th>
                                <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">Rank</th>
                                <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">MSP</th>
                                <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">Vehicle</th>
                                <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">Last Drive</th>
                                <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredQualifications.map((qual) => (
                                <tr
                                  key={qual.id}
                                  className="border-t hover-elevate cursor-pointer"
                                  onClick={() => setSelectedQual(qual)}
                                  data-testid={`row-qualification-${qual.id}`}
                                >
                                  <td className="py-3 px-4 font-medium">{qual.user?.fullName || "Unknown"}</td>
                                  <td className="py-3 px-4 text-muted-foreground">{qual.user?.rank || "-"}</td>
                                  <td className="py-3 px-4 text-muted-foreground">
                                    {msps.find(m => m.id === qual.user?.mspId)?.name || "-"}
                                  </td>
                                  <td className="py-3 px-4">
                                    <Badge variant="outline">{qual.vehicleType}</Badge>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-muted-foreground">
                                    {qual.lastDriveDate ? format(new Date(qual.lastDriveDate), "dd MMM yyyy") : "Never"}
                                  </td>
                                  <td className="py-3 px-4">
                                    {getStatusBadge(qual.status, qual.daysRemaining)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Car className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">No qualifications found</p>
                      <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or add a new qualification</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedQual && (
              <div className="hidden lg:block lg:col-span-1" style={{display: 'none'}}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-lg">Drive History</CardTitle>
                      <CardDescription className="text-sm">
                        {selectedQual.user?.fullName} - {selectedQual.vehicleType}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedQual(null)}
                      data-testid="button-close-detail-panel"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-md">
                      <div>
                        <p className="text-xs text-muted-foreground">Qualified</p>
                        <p className="text-sm font-medium">
                          {format(new Date(selectedQual.qualifiedOnDate), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expires</p>
                        <p className="text-sm font-medium">
                          {format(new Date(selectedQual.currencyExpiryDate), "dd MMM yyyy")}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold">Drive Logs</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          driveLogForm.setValue("vehicleType", selectedQual.vehicleType);
                          setIsAddingLog(true);
                        }}
                        data-testid="button-add-drive-log-detail"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>

                    {logsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                      </div>
                    ) : selectedQualLogs.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {selectedQualLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start justify-between p-3 border rounded-md hover-elevate"
                            data-testid={`drive-log-detail-${log.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Gauge className="w-4 h-4 text-primary" />
                                <p className="text-sm font-medium">{log.vehicleNo}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(log.date), "dd MMM yyyy")} • {log.distanceKm.toFixed(1)} km
                              </p>
                              {log.remarks && (
                                <p className="text-xs text-muted-foreground mt-1">{log.remarks}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingLog(log)}
                              data-testid={`button-delete-log-${log.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8">
                        <Gauge className="w-10 h-10 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">No drive logs yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedQual && (
        <Dialog open={!!selectedQual} onOpenChange={() => setSelectedQual(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sticky top-0 bg-background pb-4">
              <DialogTitle>Drive History</DialogTitle>
              <DialogDescription>
                {selectedQual.user?.fullName} - {selectedQual.vehicleType}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-md">
                <div>
                  <p className="text-xs text-muted-foreground">Qualified</p>
                  <p className="text-sm font-medium">
                    {format(new Date(selectedQual.qualifiedOnDate), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="text-sm font-medium">
                    {format(new Date(selectedQual.currencyExpiryDate), "dd MMM yyyy")}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Drive Logs</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    driveLogForm.setValue("vehicleType", selectedQual.vehicleType);
                    setIsAddingLog(true);
                  }}
                  data-testid="button-add-drive-log-detail-mobile"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              {logsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              ) : selectedQualLogs.length > 0 ? (
                <div className="space-y-2">
                  {selectedQualLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-3 border rounded-md"
                      data-testid={`drive-log-detail-mobile-${log.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-primary" />
                          <p className="text-sm font-medium">{log.vehicleNo}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.date), "dd MMM yyyy")} • {log.distanceKm.toFixed(1)} km
                        </p>
                        {log.remarks && (
                          <p className="text-xs text-muted-foreground mt-1">{log.remarks}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingLog(log)}
                        data-testid={`button-delete-log-mobile-${log.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Gauge className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No drive logs yet</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isAddingQual} onOpenChange={setIsAddingQual}>
        <DialogContent data-testid="dialog-add-qualification">
          <DialogHeader>
            <DialogTitle>Add Qualification</DialogTitle>
            <DialogDescription>
              Create a new driver qualification
            </DialogDescription>
          </DialogHeader>
          <Form {...qualForm}>
            <form onSubmit={qualForm.handleSubmit(handleSubmitQual)} className="space-y-4">
              <FormField
                control={qualForm.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User</FormLabel>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name..."
                          value={userSearchTerm}
                          onChange={(e) => {
                            setUserSearchTerm(e.target.value);
                            if (!e.target.value) {
                              setSelectedUserId("");
                              field.onChange("");
                            }
                          }}
                          className="pl-10"
                          data-testid="input-search-user"
                          disabled={createQualMutation.isPending}
                        />
                      </div>
                      {selectedUserId && (
                        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <span className="text-sm">
                            {users.find(u => u.id === selectedUserId)?.fullName}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId("");
                              setUserSearchTerm("");
                              field.onChange("");
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {userSearchTerm && !selectedUserId && (
                        <div className="border rounded-md max-h-48 overflow-y-auto">
                          {users
                            .filter(u => u.role === "soldier" && u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()))
                            .map(u => (
                              <div
                                key={u.id}
                                className="p-2 hover-elevate cursor-pointer text-sm"
                                onClick={() => {
                                  setSelectedUserId(u.id);
                                  setUserSearchTerm(u.fullName);
                                  field.onChange(u.id);
                                }}
                                data-testid={`user-option-${u.id}`}
                              >
                                <div className="font-medium">{u.fullName}</div>
                                <div className="text-xs text-muted-foreground">{u.rank || "No rank"} • {msps.find(m => m.id === u.mspId)?.name || "No MSP"}</div>
                              </div>
                            ))}
                          {users.filter(u => u.role === "soldier" && u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase())).length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No soldiers found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={qualForm.control}
                name="vehicleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={createQualMutation.isPending}>
                      <FormControl>
                        <SelectTrigger data-testid="select-qual-vehicle-type">
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TERREX">Terrex</SelectItem>
                        <SelectItem value="BELREX">Belrex</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={qualForm.control}
                name="qualifiedOnDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qualified Date</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        disabled={createQualMutation.isPending}
                        data-testid="input-qual-date"
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
                  onClick={() => setIsAddingQual(false)}
                  disabled={createQualMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createQualMutation.isPending} data-testid="button-submit-qualification">
                  {createQualMutation.isPending ? "Adding..." : "Add Qualification"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddingLog} onOpenChange={setIsAddingLog}>
        <DialogContent data-testid="dialog-add-drive-log-admin">
          <DialogHeader>
            <DialogTitle>Add Drive Log</DialogTitle>
            <DialogDescription>
              Record a drive for {selectedQual?.user?.fullName}
            </DialogDescription>
          </DialogHeader>
          <Form {...driveLogForm}>
            <form onSubmit={driveLogForm.handleSubmit(handleSubmitLog)} className="space-y-4">
              <FormField
                control={driveLogForm.control}
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
                        data-testid="input-log-vehicle-no"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={driveLogForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Drive</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        disabled={createLogMutation.isPending}
                        data-testid="input-log-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={driveLogForm.control}
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
                          data-testid="input-log-initial-mileage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={driveLogForm.control}
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
                          data-testid="input-log-final-mileage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={driveLogForm.control}
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
                        data-testid="input-log-remarks"
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
                <Button type="submit" disabled={createLogMutation.isPending} data-testid="button-submit-drive-log-admin">
                  {createLogMutation.isPending ? "Adding..." : "Add Drive Log"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLog} onOpenChange={() => setDeletingLog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Drive Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this drive log? This will recalculate the driver's currency.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLog}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-log"
            >
              Delete Log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showBatchImport} onOpenChange={closeBatchImport}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-batch-import">
          <DialogHeader>
            <DialogTitle>Batch Import Qualifications</DialogTitle>
            <DialogDescription>
              Paste tab-separated data with format: Name, Vehicle Type, Date (M/D/YYYY)
            </DialogDescription>
          </DialogHeader>

          {!importResults ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-semibold mb-2">Expected Format:</p>
                <code className="text-xs">LAU LU WEI&nbsp;&nbsp;&nbsp;&nbsp;Terrex&nbsp;&nbsp;5/23/2025</code>
                <p className="mt-2 text-muted-foreground">
                  Each line should have: Full Name (tab) Vehicle Type (tab) Date
                </p>
              </div>

              <Textarea
                placeholder="Paste your qualification data here..."
                value={batchImportData}
                onChange={(e) => setBatchImportData(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                disabled={batchImportMutation.isPending}
                data-testid="textarea-batch-import"
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeBatchImport}
                  disabled={batchImportMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchImport}
                  disabled={batchImportMutation.isPending || !batchImportData.trim()}
                  data-testid="button-submit-batch-import"
                >
                  {batchImportMutation.isPending ? "Importing..." : "Import Qualifications"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-lg">Import Complete</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Successfully imported {importResults.success.length} qualifications.
                  {importResults.failed.length > 0 && ` ${importResults.failed.length} failed.`}
                </p>
              </div>

              {importResults.success.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-600">Successful Imports ({importResults.success.length})</h4>
                  <div className="rounded-md border max-h-[200px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Vehicle</th>
                          <th className="text-left p-2">Qualified Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.success.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{item.user}</td>
                            <td className="p-2">{item.vehicleType}</td>
                            <td className="p-2">{format(new Date(item.qualifiedDate), "MMM dd, yyyy")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResults.failed.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-destructive">Failed Imports ({importResults.failed.length})</h4>
                  <div className="rounded-md border max-h-[200px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Line</th>
                          <th className="text-left p-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.failed.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 font-mono text-xs">{item.line}</td>
                            <td className="p-2 text-destructive">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button onClick={closeBatchImport}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
