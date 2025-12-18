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
      <Navbar user={user} pageTitle="Currency Drives" />

      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Currency Drives</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Manage QR codes for currency drive verification
              </p>
            </div>
          </div>

          <AdminCurrencyDrives />
        </div>
      </div>
    </div>
  );
}
