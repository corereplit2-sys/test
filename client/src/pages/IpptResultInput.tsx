import React from "react";
import { useQuery } from "@tanstack/react-query";
import { SafeUser } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { IpptResultInput } from "@/components/ippt/IpptResultInput";
import { PageLoader } from "@/components/ui/PageLoader";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function IpptResultInputPage() {
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const [, setLocation] = useLocation();

  if (isLoading || !user) {
    return <PageLoader />;
  }

  // Only allow commanders and admins to input results
  if (user.role !== "commander" && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} pageTitle="IPPT Result Input" />
        <div className="pt-16">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
              <p className="text-muted-foreground mt-2">
                Only commanders and admins can input IPPT results.
              </p>
              <Button onClick={() => setLocation("/ippt")} className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to IPPT Tracker
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="IPPT Result Input" />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/ippt")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to IPPT Tracker
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold">IPPT Result Input</h1>
            <p className="text-muted-foreground mt-1">
              Enter IPPT performance data for participants
            </p>
          </div>
          
          <IpptResultInput onSaveComplete={() => setLocation("/ippt")} />
        </div>
      </div>
    </div>
  );
}
