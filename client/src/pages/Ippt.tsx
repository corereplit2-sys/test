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

  // Redirect to the actual IPPT tracker
  return <Redirect to="/ippt-tracker" />;
}