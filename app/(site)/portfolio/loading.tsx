import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <LoadingScreen className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[4/5] rounded-2xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </LoadingScreen>
  );
}
