 import { useQuery } from "@tanstack/react-query";
import { SafeUser, InsertUser, UpdateUser, Msp, type QualificationWithStatus } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  type: "msp" | "rank";
  label: string;
  value: string;
};

interface AdminUsersProps {
  showCreateDialog: boolean;
  setShowCreateDialog: (show: boolean) => void;
}

export function AdminUsers({ showCreateDialog, setShowCreateDialog }: AdminUsersProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTags, setFilterTags] = useState<FilterTag[]>([]);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SafeUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);

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

  const addFilterTag = (type: "msp" | "rank", value: string, label: string) => {
    const id = `${type}-${value}`;
    if (!filterTags.find(tag => tag.id === id)) {
      setFilterTags([...filterTags, { id, type, label, value }]);
    }
    setShowFilterPopover(false);
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
      credits: 10,
      password: "",
      rank: "",
      mspId: "",
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

  const openEditDialog = (user: SafeUser) => {
    setEditingUser(user);
    editForm.reset({
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      credits: user.credits,
      password: "",
      rank: user.rank || "",
      mspId: user.mspId || "",
    });
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card data-testid="card-user-analytics-total">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{soldiers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Soldiers & Commanders</p>
          </CardContent>
        </Card>
        <Card data-testid="card-user-analytics-qualifications">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Qualifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualifications.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {soldiers.length > 0 ? (qualifications.length / soldiers.length).toFixed(1) : "0"} per user
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-user-analytics-current">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {qualifications.filter(q => q.status === "CURRENT").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {qualifications.length > 0
                ? `${((qualifications.filter(q => q.status === "CURRENT").length / qualifications.length) * 100).toFixed(0)}% of total`
                : "0%"
              }
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-user-analytics-expired">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {qualifications.filter(q => q.status === "EXPIRED").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {qualifications.length > 0
                ? `${((qualifications.filter(q => q.status === "EXPIRED").length / qualifications.length) * 100).toFixed(0)}% of total`
                : "0%"
              }
            </p>
          </CardContent>
        </Card>
      </div>

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
                      const current = mspQuals.filter(q => q.status === "CURRENT").length;
                      const expired = mspQuals.filter(q => q.status === "EXPIRED").length;
                      
                      return (
                        <tr key={msp.id} className="border-t hover-elevate">
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
                          <tr key={rank} className="border-t hover-elevate">
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

      <Card className="mb-6">
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
            <div className="border rounded-md">
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
                              ? "bg-yellow-500 text-yellow-950" 
                              : user.role === "commander"
                              ? "bg-purple-500 text-purple-950"
                              : "bg-blue-500 text-blue-950"
                          }
                        >
                          {user.role === "admin" ? "Admin" : user.role === "commander" ? "Commander" : "Soldier"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {user.role !== "admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingUser(user)}
                              data-testid={`button-delete-${user.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
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
            <DialogDescription>Update user details and credits</DialogDescription>
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
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="credits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credits</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.5"
                          className="h-12"
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          data-testid="input-edit-credits"
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
    </>
  );
}
