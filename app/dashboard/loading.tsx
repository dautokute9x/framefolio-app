export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-9 w-48 animate-pulse rounded-xl bg-secondary" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-secondary" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="aspect-[3/2] animate-pulse bg-secondary" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
