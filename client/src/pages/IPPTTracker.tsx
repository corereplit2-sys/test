import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { SafeUser } from "@shared/schema";
import { Navbar } from "@/components/Navbar";

export default function IPPTTracker() {

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
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="IPPT Tracker" />
      <div className="pt-32 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold" data-testid="page-ippt-title">
            Work in Progress
          </h2>
          <p className="text-muted-foreground max-w-md">
            The IPPT Tracker feature is coming soon. We're currently working on bringing this feature to you.
          </p>
        </div>
      </div>
    </div>
  );
}