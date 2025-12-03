import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AdminCurrencyDrives } from "@/components/admin/AdminCurrencyDrives";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SafeUser } from "@shared/schema";

export default function DriveQR() {
  const [, setLocation] = useLocation();
  
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
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin Dashboard
          </Button>
        </div>

        <AdminCurrencyDrives />
      </div>
    </div>
  );
}
