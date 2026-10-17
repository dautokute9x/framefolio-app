import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <LoadingScreen className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-10 w-28" />
          </div>
        ))}
      </div>
    </LoadingScreen>
  );
}
