import { cn } from "@/lib/utils";
import type { Session } from "@/lib/session";

interface StatusBadgeProps {
  status: Session["status"];
  className?: string;
}

const config: Record<Session["status"], { label: string; classes: string; dot?: boolean }> = {
  pending: {
    label: "Pending",
    classes: "bg-muted text-muted-foreground",
  },
  processing: {
    label: "Processing",
    classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dot: true,
  },
  completed: {
    label: "Completed",
    classes: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  failed: {
    label: "Failed",
    classes: "bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, classes, dot } = config[status] ?? config.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        classes,
        className
      )}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {label}
    </span>
  );
}
