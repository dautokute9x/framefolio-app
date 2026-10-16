import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

export const STATUS_KEY: Record<JobStatus, string> = {
  Draft: "draft",
  Sent: "sent",
  "Client Selecting": "selecting",
  Editing: "editing",
  Delivered: "delivered",
};

const STYLE: Record<JobStatus, string> = {
  Draft: "border-border bg-card text-muted-foreground",
  Sent: "border-transparent bg-sky-100 text-sky-800",
  "Client Selecting": "border-transparent bg-amber-100 text-amber-800",
  Editing: "border-transparent bg-violet-100 text-violet-800",
  Delivered: "border-transparent bg-emerald-100 text-emerald-800",
};

export function AlbumStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const t = useTranslations("status");
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STYLE[status],
        className
      )}
    >
      {t(STATUS_KEY[status])}
    </span>
  );
}
