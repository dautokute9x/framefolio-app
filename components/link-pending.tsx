"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Put inside a <Link>: shows a spinner instead of `children` (usually the
 * link's icon) while the page it points to is loading.
 */
export function LinkPending({ children, className }: { children?: React.ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return <>{children}</>;
  return <Loader2 aria-hidden className={cn("h-4 w-4 shrink-0 animate-spin", className)} />;
}
