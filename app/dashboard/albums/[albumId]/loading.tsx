import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

/** Album pages (photos / selections / details): header, tabs and a photo grid. */
export default function AlbumLoading() {
  return (
    <LoadingScreen className="space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="flex gap-4 border-b border-border pb-2">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </LoadingScreen>
  );
}
