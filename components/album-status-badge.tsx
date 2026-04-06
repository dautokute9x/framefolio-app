import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/types";

const variantMap: Record<JobStatus, "secondary" | "default" | "success" | "outline"> = {
  Draft: "outline",
  Sent: "secondary",
  "Client Selecting": "default",
  Editing: "secondary",
  Delivered: "success",
};

export function AlbumStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={variantMap[status]}>{status}</Badge>;
}
