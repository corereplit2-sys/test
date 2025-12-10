import { useQuery } from "@tanstack/react-query";
import { SafeUser } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { PageLoader } from "@/components/ui/PageLoader";

export default function Users() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading || !user) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="User Management" />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">User Management</h1>
              <p className="text-muted-foreground mt-1 text-sm">Manage soldiers, MSP assignments, and ranks</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setShowBatchImport(true)} data-testid="button-batch-import-users" size="sm" className="md:size-auto">
                <Upload className="w-4 h-4 mr-2" />
                Batch Import
              </Button>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-user" size="sm" className="md:size-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>
          <AdminUsers 
            showCreateDialog={showCreateDialog} 
            setShowCreateDialog={setShowCreateDialog}
            showBatchImport={showBatchImport}
            setShowBatchImport={setShowBatchImport}
          />
        </div>
      </div>
    </div>
  );
}
