import { useQuery } from "@tanstack/react-query";
import { SafeUser } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { AdminUserCredits } from "@/components/admin/AdminUserCredits";
import { useLocation } from "wouter";
import { PageLoader } from "@/components/ui/PageLoader";

export default function Credits() {
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading || !user) {
    return <PageLoader />;
  }

  if (user.role !== "admin" && user.role !== "commander") {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="Edit User Credits" />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <AdminUserCredits />
        </div>
      </div>
    </div>
  );
}
