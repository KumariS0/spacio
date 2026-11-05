import { cn } from "@/lib/cn";
import { occupancyLabel, occupancyLevel, occupancyPercent } from "@/lib/occupancy";
import type { Availability } from "@/lib/types";

const barColor = {
  plenty: "bg-ok",
  moderate: "bg-moderate-bar",
  busy: "bg-busy",
  full: "bg-busy",
  none: "bg-off",
};
const textColor = {
  plenty: "text-ok",
  moderate: "text-moderate",
  busy: "text-busy",
  full: "text-busy",
  none: "text-muted",
};

export function OpenStatus({ availability, closed, className }: { availability?: Availability; closed?: boolean; className?: string }) {
  const open = !closed && Boolean(availability?.is_open_now);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px]", open ? "text-ok" : "text-muted", className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", open ? "bg-ok" : "bg-off")} />
      {closed ? "Temporarily closed" : open ? "Open now" : "Closed now"}
    </span>
  );
}

/** Occupancy summary with bar. Data always comes from get_facility_availability. */
export function OccupancyMeter({ availability, compact, className }: { availability?: Availability; compact?: boolean; className?: string }) {
  if (!availability || availability.booking_mode === "none" || availability.capacity == null) {
    return <p className={cn("text-[13px] text-muted", className)}>Location only · not bookable</p>;
  }
  const pct = occupancyPercent(availability.capacity, availability.available) ?? 0;
  const level = occupancyLevel(pct);
  const unit = availability.booking_mode === "seat" ? "seats" : "places";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 whitespace-nowrap text-[13px]">
        <span className="tabular font-medium text-ink">{pct}% occupied</span>
        <span className={cn("truncate font-medium", textColor[level])}>{occupancyLabel[level]}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-sunken"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${pct}% occupied`}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]", barColor[level])} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      {!compact && (
        <p className="tabular text-[13px] text-muted">
          <span className="font-medium text-ink">{availability.available}</span> of {availability.capacity} {unit} free right now
        </p>
      )}
    </div>
  );
}
