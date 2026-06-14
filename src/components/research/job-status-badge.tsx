import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type JobStatus = "pending" | "running" | "done" | "failed";

const STATUS_CONFIG: Record<
  JobStatus,
  { className: string; label: string }
> = {
  pending: {
    className: "bg-neutral-100 text-neutral-500 border-neutral-200",
    label: "Queued",
  },
  running: {
    className: "bg-blue-100 text-blue-700 border-blue-200",
    label: "Researching",
  },
  done: {
    className: "bg-green-100 text-green-700 border-green-200",
    label: "Done",
  },
  failed: {
    className: "bg-red-100 text-red-700 border-red-200",
    label: "Failed",
  },
};

/**
 * JobStatusBadge — displays the current research job status as a colored badge.
 * Maps pending → Queued, running → Researching, done → Done, failed → Failed.
 */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-normal px-1.5 py-0.5 border", config.className)}
    >
      {config.label}
    </Badge>
  );
}
