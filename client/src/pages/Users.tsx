import { useQuery } from "@tanstack/react-query";
import { SafeUser } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function Users() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="User Management" />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">User Management</h1>
              <p className="text-muted-foreground mt-1">Manage soldiers, MSP assignments, and ranks</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-user">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
          <AdminUsers showCreateDialog={showCreateDialog} setShowCreateDialog={setShowCreateDialog} />
        </div>
      </div>
    </div>
  );
}
