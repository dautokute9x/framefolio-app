import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function ClientsLoading() {
  return (
    <LoadingScreen className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-11 w-36" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-9 w-48 rounded-full" />
        </div>
      ))}
    </LoadingScreen>
  );
}
