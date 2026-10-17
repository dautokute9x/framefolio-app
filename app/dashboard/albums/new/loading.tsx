import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function NewAlbumLoading() {
  return (
    <LoadingScreen className="mx-auto max-w-3xl space-y-5">
      <Skeleton className="h-10 w-48" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 sm:col-span-2" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        </div>
      ))}
    </LoadingScreen>
  );
}
