import { cn } from "@/lib/cn";
import type { ReservationStatus } from "@/lib/types";

const STYLES: Record<ReservationStatus, { label: string; className: string }> = {
  BOOKED: { label: "Booked", className: "bg-reserved-tint text-reserved-ink" },
  CHECKED_IN: { label: "Checked in", className: "bg-ok-tint text-ok-ink" },
  CHECKED_OUT: { label: "Completed", className: "bg-forest-tint text-forest-deep" },
  CANCELLED: { label: "Cancelled", className: "bg-off-tint text-ink-soft" },
  EXPIRED: { label: "Expired", className: "bg-off-tint text-ink-soft" },
  NO_SHOW: { label: "No-show", className: "bg-busy-tint text-busy-ink" },
};

export function statusLabel(status: ReservationStatus) {
  return STYLES[status].label;
}

export function StatusBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.className, className)}>
      {status === "CHECKED_IN" && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ok" />}
      {s.label}
    </span>
  );
}
