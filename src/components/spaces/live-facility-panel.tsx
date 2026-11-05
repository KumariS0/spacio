"use client";

import { useAvailability } from "@/components/live/live-availability";
import { formatClock } from "@/lib/time";
import type { Facility } from "@/lib/types";
import { cn } from "@/lib/cn";
import { OccupancyMeter, OpenStatus } from "./occupancy";

/** Live occupancy summary for one facility (details page). */
export function LiveFacilityPanel({ facility, className }: { facility: Facility; className?: string }) {
  const a = useAvailability(facility.id);
  const bookable = facility.booking_mode !== "none";
  return (
    <div className={cn("rounded-card border border-line bg-surface p-4", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <OpenStatus availability={a} closed={facility.is_temporarily_closed} />
        {a?.opens_at && a?.closes_at && (
          <span className="tabular text-[13px] text-muted">
            Today {formatClock(a.opens_at)} – {formatClock(a.closes_at)}
          </span>
        )}
        {a && !a.opens_at && <span className="text-[13px] text-muted">Closed today</span>}
      </div>
      {bookable && a && a.capacity != null ? (
        <>
          <OccupancyMeter availability={a} compact className="mt-3" />
          <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              { k: "Free", v: a.available, c: "text-ok" },
              { k: "In use", v: a.occupied, c: "text-busy" },
              { k: "Reserved", v: a.reserved, c: "text-reserved" },
              { k: "Total", v: a.capacity, c: "text-ink" },
            ].map((x) => (
              <div key={x.k} className="rounded-[10px] bg-paper/70 px-1 py-2">
                <dt className="text-[11px] text-muted">{x.k}</dt>
                <dd className={cn("tabular mt-0.5 font-serif text-xl", x.c)}>{x.v}</dd>
              </div>
            ))}
          </dl>
          {facility.booking_mode === "seat" && a.unavailable > 0 && (
            <p className="mt-2 text-xs text-muted">{a.unavailable} seat{a.unavailable > 1 ? "s" : ""} out of service</p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">Location only — no live occupancy for this space.</p>
      )}
    </div>
  );
}
