import React from "react";
import { Navbar } from "@/components/Navbar";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { SafeUser } from "@shared/schema";

export default function IPPT() {
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="p-6">
      <Navbar user={user} pageTitle="IPPT Tracker" />

      <h2 className="text-2xl font-semibold mb-4" data-testid="page-ippt-title">
        IPPT
      </h2>
      <p className="text-sm text-muted-foreground">
        Placeholder page for IPPT Tracker. Add your UI and data fetching here.
      </p>
    </div>
  );
}