 import { useQuery, useMutation } from "@tanstack/react-query";
import { SafeUser, InsertUser, UpdateUser, Msp, type QualificationWithStatus } from "@shared/schema";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash, Search, X, Users, UserCheck, UserX, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, updateUserSchema } from "@shared/schema";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { z } from "zod";

type FilterTag = {
  id: string;
  type: "msp" | "rank" | "role" | "status";
  label: string;
  value: string;
};

interface AdminUsersProps {
  showCreateDialog: boolean;
  setShowCreateDialog: (show: boolean) => void;
  showBatchImport: boolean;
  setShowBatchImport: (show: boolean) => void;
}

export function AdminUsers({ showCreateDialog, setShowCreateDialog, showBatchImport, setShowBatchImport }: AdminUsersProps) {
  const { toast } = useToast();
  const usersCardRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTags, setFilterTags] = useState<FilterTag[]>([]);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SafeUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [batchImportData, setBatchImportData] = useState("");
  const [importResults, setImportResults] = useState<any>(null);

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: msps = [] } = useQuery<Msp[]>({
    queryKey: ["/api/msps"],
  });

  const { data: qualifications = [] } = useQuery<QualificationWithStatus[]>({
    queryKey: ["/api/qualifications"],
  });

  const uniqueRanks = Array.from(new Set(users.map(u => u.rank).filter(Boolean))) as string[];

  const addFilterTag = (type: "msp" | "rank" | "role" | "status", value: string, label: string) => {
    const id = `${type}-${value}`;
    if (!filterTags.find(tag => tag.id === id)) {
      setFilterTags([...filterTags, { id, type, label, value }]);
    }
    setShowFilterPopover(false);
    
    // Auto-scroll to users card
    setTimeout(() => {
      usersCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    
    // Check for rank match
    const rankMatch = uniqueRanks.find(rank => rank.toUpperCase() === upperValue);
    if (rankMatch) {
      addFilterTag("rank", rankMatch, rankMatch);
      setSearchTerm("");
      return;
    }
  };

  const getMspColor = (mspName: string): string => {
    const colors: Record<string, string> = {
      "HQ": "bg-slate-500 text-slate-950",
      "MSP 1": "bg-blue-500 text-blue-950",
      "MSP 2": "bg-green-500 text-green-950",
      "MSP 3": "bg-purple-500 text-purple-950",
      "MSP 4": "bg-orange-500 text-orange-950",
      "MSP 5": "bg-red-500 text-red-950",
    };
    return colors[mspName] || "bg-gray-500 text-gray-950";
  };

  // Sorting helper functions
  const getMspOrder = (mspId: string | null): number => {
    if (!mspId) return 999; // No MSP goes to the end
    const msp = msps.find(m => m.id === mspId);
    if (!msp) return 999;
    
    const order: Record<string, number> = {
      "HQ": 0,
      "MSP 1": 1,
      "MSP 2": 2,
      "MSP 3": 3,
      "MSP 4": 4,
      "MSP 5": 5,
    };
    
    return order[msp.name] ?? 999;
  };

  const getRankOrder = (rank: string | null): number => {
    if (!rank) return 999; // No rank goes to the end
    
    const order: Record<string, number> = {
      // Officers
      "CPT": 1,
      "2LT": 2,
      // Warrant Officers
      "1WO": 3,
      "2WO": 4,
      "3WO": 5,
      // Specialists
      "1SG": 6,
      "2SG": 7,
      "3SG": 8,
      // Enlisted
      "LCP": 9,
      "PTE": 10,
    };
    
    return order[rank] ?? 999;
  };

  // Only show soldiers and commanders in the user list (exclude admins)
  const soldiers = users.filter(user => user.role === "soldier" || user.role === "commander");
  
  const filteredUsers = soldiers
    .filter(user => {
      const matchesSearch = searchTerm === "" || 
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase());

      const mspTags = filterTags.filter(t => t.type === "msp");
      const rankTags = filterTags.filter(t => t.type === "rank");

      const matchesMsp = mspTags.length === 0 || mspTags.some(tag => user.mspId === tag.value);
      const matchesRank = rankTags.length === 0 || rankTags.some(tag => user.rank === tag.value);

      return matchesSearch && matchesMsp && matchesRank;
    })
    .sort((a, b) => {
      // First sort by MSP
      const mspOrderA = getMspOrder(a.mspId);
      const mspOrderB = getMspOrder(b.mspId);
      if (mspOrderA !== mspOrderB) return mspOrderA - mspOrderB;
      
      // Then sort by rank within MSP
      const rankOrderA = getRankOrder(a.rank);
      const rankOrderB = getRankOrder(b.rank);
      if (rankOrderA !== rankOrderB) return rankOrderA - rankOrderB;
      
      // Finally sort by name within rank
      return a.fullName.localeCompare(b.fullName);
    });

  const createForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      passwordHash: "",
      fullName: "",
      role: "soldier",
      credits: 10,
      rank: "",
      mspId: "",
      doe: "",
    },
  });

  const editForm = useForm<UpdateUser & { password?: string }>({
    resolver: zodResolver(updateUserSchema.extend({
      password: z.string().optional(),
    })),
    defaultValues: {
      username: "",
      fullName: "",
      role: "soldier",
      password: "",
      rank: "",
      mspId: "",
      dob: "",
      doe: "",
    },
  });

  const handleCreate = async (data: InsertUser) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/admin/users", data);
      toast({
        title: "User created",
        description: `${data.fullName} has been added successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowCreateDialog(false);
      createForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create user",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: UpdateUser & { password?: string }) => {
    if (!editingUser) return;
    
    setIsSubmitting(true);
    try {
      // Remove password field if it's empty (keep current password)
      const updateData = { ...data };
      if (!updateData.password || updateData.password.trim() === "") {
        delete updateData.password;
      }
      
      await apiRequest("PUT", `/api/admin/users/${editingUser.id}`, updateData);
      toast({
        title: "User updated",
        description: `${data.fullName} has been updated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      editForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    try {
      await apiRequest("DELETE", `/api/admin/users/${deletingUser.id}`);
      toast({
        title: "User deleted",
        description: `${deletingUser.fullName} has been removed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeletingUser(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user",
      });
    }
  };

  const batchImportMutation = useMutation({
    mutationFn: async (data: string) => {
      return await apiRequest("POST", "/api/admin/users/batch-import", { data });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
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
        description: "Please paste the user data",
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

  const openEditDialog = (user: SafeUser) => {
    setEditingUser(user);
    editForm.reset({
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      password: "",
      rank: user.rank || "",
      mspId: user.mspId || "",
      dob: user.dob || "",
      doe: user.doe || "",
    });
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card data-testid="card-user-msp-breakdown">
          <CardHeader>
            <CardTitle>MSP User Distribution</CardTitle>
            <CardDescription>Users and qualifications by MSP</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide py-2 px-3">MSP</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wide py-2 px-3">Users</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wide py-2 px-3">Quals</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wide py-2 px-3">Current</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wide py-2 px-3">Expired</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msps.map(msp => {
                      const mspUsers = soldiers.filter(u => u.mspId === msp.id);
                      const mspQuals = qualifications.filter(q => q.user?.mspId === msp.id);
                      const current = mspQuals.filter(q => q.status === "CURRENT" || q.status === "EXPIRING_SOON").length;
                      const expired = mspQuals.filter(q => q.status === "EXPIRED").length;
                      
                      return (
                        <tr 
                          key={msp.id} 
                          className="border-t hover-elevate cursor-pointer" 
                          onClick={() => addFilterTag("msp", msp.id, msp.name)}
                        >
                          <td className="py-2 px-3 font-medium">{msp.name}</td>
                          <td className="py-2 px-3 text-center">{mspUsers.length}</td>
                          <td className="py-2 px-3 text-center">{mspQuals.length}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-green-600 dark:text-green-400 font-medium">{current}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-red-600 dark:text-red-400 font-medium">{expired}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="border-t-2 bg-muted/30 font-semibold">
                      <td className="py-2 px-3">Total</td>
                      <td className="py-2 px-3 text-center">{soldiers.length}</td>
                      <td className="py-2 px-3 text-center">{qualifications.length}</td>
                      <td className="py-2 px-3 text-center text-green-600 dark:text-green-400">
                        {qualifications.filter(q => q.status === "CURRENT" || q.status === "EXPIRING_SOON").length}
                      </td>
                      <td className="py-2 px-3 text-center text-red-600 dark:text-red-400">
                        {qualifications.filter(q => q.status === "EXPIRED").length}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-user-rank-breakdown">
          <CardHeader>
            <CardTitle>Rank Distribution</CardTitle>
            <CardDescription>User count by rank</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide py-2 px-3">Rank</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wide py-2 px-3">Users</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wide py-2 px-3">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueRanks
                      .sort((a, b) => getRankOrder(a) - getRankOrder(b))
                      .map(rank => {
                        const rankUsers = soldiers.filter(u => u.rank === rank);
                        const isCommander = rankUsers.length > 0 && rankUsers[0].role === "commander";
                        
                        return (
                          <tr 
                            key={rank} 
                            className="border-t hover-elevate cursor-pointer"
                            onClick={() => addFilterTag("rank", rank, rank)}
                          >
                            <td className="py-2 px-3 font-medium">{rank}</td>
                            <td className="py-2 px-3 text-center">{rankUsers.length}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge
                                variant="secondary"
                                className={
                                  isCommander
                                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
                                    : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                }
                              >
                                {isCommander ? "Commander" : "Soldier"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6" ref={usersCardRef}>
        <CardContent className="pt-6">
          <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or type filter (e.g., HQ, MSP 1, CPT)..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
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
                  
                  {uniqueRanks.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Rank</p>
                      <div className="space-y-1">
                        {uniqueRanks.map(rank => (
                          <Button
                            key={rank}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => addFilterTag("rank", rank, rank)}
                            data-testid={`filter-rank-${rank}`}
                          >
                            {rank}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {filterTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filterTags.map(tag => (
                <Badge key={tag.id} variant="secondary" className="gap-1" data-testid={`tag-${tag.id}`}>
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

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground" data-testid="text-user-count">
                {filterTags.length > 0 || searchTerm ? (
                  <>Showing <span className="font-semibold text-foreground">{filteredUsers.length}</span> of <span className="font-semibold text-foreground">{soldiers.length}</span> soldiers</>
                ) : (
                  <>Total: <span className="font-semibold text-foreground">{soldiers.length}</span> soldiers</>
                )}
              </p>
            </div>

            {/* Mobile Card View */}
            <div className="space-y-3 md:hidden">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="border rounded-md p-4 hover:bg-accent transition-colors"
                  data-testid={`user-card-${user.id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-semibold text-base truncate">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user.rank || "-"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant="secondary"
                        className={
                          user.role === "admin"
                            ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                            : user.role === "commander"
                            ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                        }
                      >
                        {user.role === "admin" ? "Admin" : user.role === "commander" ? "Commander" : "Soldier"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">MSP:</span>
                      {user.mspId ? (
                        <Badge
                          variant="secondary"
                          className={getMspColor(msps.find(m => m.id === user.mspId)?.name || "")}
                        >
                          {msps.find(m => m.id === user.mspId)?.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>

                  {(user?.role !== "admin") && (
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(user)}
                        className="h-8 w-8 p-0 flex-shrink-0"
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingUser(user)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive flex-shrink-0"
                        data-testid={`button-delete-${user.id}`}
                      >
                        <Trash className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block border rounded-md">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">Name</th>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">Rank</th>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">MSP</th>
                      <th className="text-left text-sm font-semibold uppercase tracking-wide py-3 px-4">Role</th>
                      <th className="text-right text-sm font-semibold uppercase tracking-wide py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-t hover-elevate" data-testid={`user-row-${user.id}`}>
                        <td className="py-3 px-4 font-medium">{user.fullName}</td>
                        <td className="py-3 px-4 text-muted-foreground">{user.rank || "-"}</td>
                        <td className="py-3 px-4">
                          {user.mspId ? (
                            <Badge
                              variant="secondary"
                              className={getMspColor(msps.find(m => m.id === user.mspId)?.name || "")}
                            >
                              {msps.find(m => m.id === user.mspId)?.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className={
                              user.role === "admin"
                                ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                                : user.role === "commander"
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
                                : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                            }
                          >
                            {user.role === "admin" ? "Admin" : user.role === "commander" ? "Commander" : "Soldier"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(user)}
                              className="h-8 w-8 p-0"
                              data-testid={`button-edit-${user.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {user.role !== "admin" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletingUser(user)}
                                className="h-8 w-8 p-0"
                                data-testid={`button-delete-${user.id}`}
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new soldier or admin to the system</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={createForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-12" data-testid="input-create-fullname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-12" data-testid="input-create-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="rank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rank</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="e.g., CPL, 3SG" className="h-12" data-testid="input-create-rank" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="h-12" data-testid="input-create-dob" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="doe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Enlistment</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ""} className="h-12" data-testid="input-create-doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="mspId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MSP</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-12" data-testid="select-create-msp">
                            <SelectValue placeholder="Select MSP" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {msps.map(msp => (
                            <SelectItem key={msp.id} value={msp.id}>{msp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" className="h-12" data-testid="input-create-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12" data-testid="select-create-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="soldier">Soldier</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="credits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Credits</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.5"
                          className="h-12"
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          data-testid="input-create-credits"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} data-testid="button-submit-create">
                  {isSubmitting ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={editForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-12" data-testid="input-edit-fullname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-12" data-testid="input-edit-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="rank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rank</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="e.g., CPL, 3SG" className="h-12" data-testid="input-edit-rank" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ""} className="h-12" data-testid="input-edit-dob" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="doe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Enlistment</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ""} className="h-12" data-testid="input-edit-doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="mspId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MSP</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-12" data-testid="select-edit-msp">
                            <SelectValue placeholder="Select MSP" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {msps.map(msp => (
                            <SelectItem key={msp.id} value={msp.id}>{msp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (leave blank to keep current)</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" className="h-12" data-testid="input-edit-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12" data-testid="select-edit-role">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="soldier">Soldier</SelectItem>
                          <SelectItem value="commander">Commander</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} data-testid="button-submit-edit">
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingUser?.fullName}? This action cannot be undone
              and will also delete all their bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showBatchImport} onOpenChange={closeBatchImport}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-batch-import-users">
          <DialogHeader>
            <DialogTitle>Batch Import Users</DialogTitle>
            <DialogDescription>
              Paste tab-separated data with format: Username, Full Name, Rank, MSP
            </DialogDescription>
          </DialogHeader>

          {!importResults ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-semibold mb-2">Expected Format:</p>
                <code className="text-xs">john_doe&nbsp;&nbsp;&nbsp;&nbsp;JOHN DOE&nbsp;&nbsp;&nbsp;&nbsp;PTE&nbsp;&nbsp;&nbsp;&nbsp;MSP 1</code>
                <p className="mt-2 text-muted-foreground">
                  Each line should have: Username (tab) Full Name (tab) Rank (tab) MSP
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  All users will be created with default password: <code className="bg-background px-1 py-0.5 rounded">password123</code>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rank determines role: Sergeants and above (3SG, 2SG, 1SG, 3WO, 2WO, 1WO, 2LT, CPT) become commanders.
                </p>
              </div>

              <Textarea
                placeholder="Paste your user data here..."
                value={batchImportData}
                onChange={(e) => setBatchImportData(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                disabled={batchImportMutation.isPending}
                data-testid="textarea-batch-import-users"
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
                  data-testid="button-submit-batch-import-users"
                >
                  {batchImportMutation.isPending ? "Importing..." : "Import Users"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-lg">Import Complete</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Successfully imported {importResults.success.length} users.
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
                          <th className="text-left p-2">Username</th>
                          <th className="text-left p-2">Full Name</th>
                          <th className="text-left p-2">Rank</th>
                          <th className="text-left p-2">MSP</th>
                          <th className="text-left p-2">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.success.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 font-mono text-xs">{item.username}</td>
                            <td className="p-2">{item.fullName}</td>
                            <td className="p-2">{item.rank || '-'}</td>
                            <td className="p-2">{item.msp}</td>
                            <td className="p-2">
                              <Badge variant={item.role === 'commander' ? 'default' : 'secondary'}>
                                {item.role}
                              </Badge>
                            </td>
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
    </>
  );
}
