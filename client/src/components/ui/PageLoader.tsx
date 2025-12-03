import { Skeleton } from "@/components/ui/skeleton";

interface PageLoaderProps {
  variant?: "default" | "card" | "table";
  count?: number;
}

export function PageLoader({ variant = "default", count = 4 }: PageLoaderProps) {
  if (variant === "card") {
    return (
      <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="space-y-2">
        {[...Array(count)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
