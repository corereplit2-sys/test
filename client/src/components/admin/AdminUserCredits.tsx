import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from "@shared/schema";
import { Search, Coins, Edit, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AdminUserCredits() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState<number>(0);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateCreditsMutation = useMutation({
    mutationFn: async ({ userId, credits }: { userId: string; credits: number }) => {
      return await apiRequest("PUT", `/api/admin/users/${userId}`, { credits });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Credits updated",
        description: "User credits have been updated successfully.",
      });
      setEditingUserId(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update credits",
      });
    },
  });

  const handleStartEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditCredits(user.credits);
  };

  const handleSaveEdit = (userId: string) => {
    if (editCredits < 0) {
      toast({
        variant: "destructive",
        title: "Invalid value",
        description: "Credits cannot be negative",
      });
      return;
    }
    updateCreditsMutation.mutate({ userId, credits: editCredits });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditCredits(0);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const soldiers = users?.filter(u => u.role === "soldier") || [];
  const filteredSoldiers = soldiers.filter(user =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.rank && user.rank.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <CardTitle>Individual Soldier Credits</CardTitle>
          </div>
          <CardDescription>
            View and adjust credits for individual soldiers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or rank..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1.5">
              {filteredSoldiers.length} soldier{filteredSoldiers.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Users Table */}
          <div className="border rounded-md">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide py-2 px-3">Rank</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide py-2 px-3">Name</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide py-2 px-3">Username</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide py-2 px-3">MSP</th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wide py-2 px-3">Credits</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wide py-2 px-3 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSoldiers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchTerm ? "No soldiers found matching your search" : "No soldiers found"}
                      </td>
                    </tr>
                  ) : (
                    filteredSoldiers.map((user) => (
                      <tr key={user.id} data-testid={`row-user-${user.id}`} className="border-t hover-elevate">
                        <td className="py-2 px-3 font-medium">
                          {user.rank || "-"}
                        </td>
                        <td className="py-2 px-3">{user.fullName}</td>
                        <td className="py-2 px-3 text-muted-foreground">{user.username}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {user.mspId ? `MSP ${user.mspId.replace('msp-', '')}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {editingUserId === user.id ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={editCredits}
                              onChange={(e) => setEditCredits(parseFloat(e.target.value) || 0)}
                              className="w-24 ml-auto text-right"
                              data-testid={`input-edit-credits-${user.id}`}
                              autoFocus
                            />
                          ) : (
                            <span className="font-mono font-medium" data-testid={`text-credits-${user.id}`}>
                              {user.credits.toFixed(1)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {editingUserId === user.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleSaveEdit(user.id)}
                                disabled={updateCreditsMutation.isPending}
                                data-testid={`button-save-credits-${user.id}`}
                                className="w-8 h-8"
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleCancelEdit}
                                disabled={updateCreditsMutation.isPending}
                                data-testid={`button-cancel-credits-${user.id}`}
                                className="w-8 h-8"
                              >
                                <X className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEdit(user)}
                                data-testid={`button-edit-credits-${user.id}`}
                                className="w-8 h-8"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
