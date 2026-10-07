import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, STATUS_LABEL, type RequestPriority, type RequestStatus } from "@/lib/domain";

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", className)}
      style={{
        color: `var(--status-${status})`,
        borderColor: `color-mix(in oklch, var(--status-${status}) 35%, transparent)`,
        backgroundColor: `color-mix(in oklch, var(--status-${status}) 12%, transparent)`,
      }}
    >
      <span className="status-dot" style={{ backgroundColor: `var(--status-${status})` }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: RequestPriority; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", className)}
      style={{
        color: `var(--prio-${priority})`,
        borderColor: `color-mix(in oklch, var(--prio-${priority}) 40%, transparent)`,
        backgroundColor: `color-mix(in oklch, var(--prio-${priority}) 10%, transparent)`,
      }}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
