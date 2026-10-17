import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-secondary", className)} />;
}

/** Wrapper for loading screens: announces "Loading…" to screen readers. */
export async function LoadingScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t("loading")}</span>
      {children}
    </div>
  );
}
