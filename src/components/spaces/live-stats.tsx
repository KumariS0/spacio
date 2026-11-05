"use client";

import { useLive } from "@/components/live/live-availability";
import { Stat } from "@/components/ui/misc";
import type { CampusStats } from "@/lib/types";

/** Campus-wide numbers, recomputed from live availability rows. */
export function LiveStats({ initial }: { initial: CampusStats }) {
  const live = useLive();
  const rows = live ? Object.values(live.byId) : [];
  const sum = (k: "available" | "occupied" | "reserved") => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
  const stats = live && live.version > 0
    ? { available: sum("available"), occupied: sum("occupied"), active: sum("occupied") + sum("reserved") }
    : { available: initial.available, occupied: initial.occupied, active: initial.active_reservations };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Facilities" value={initial.total_facilities} hint={`${initial.bookable_facilities} bookable`} />
      <Stat label="Places free now" value={stats.available} hint="Seats and capacity" />
      <Stat label="People checked in" value={stats.occupied} hint="Across campus" />
      <Stat label="Active reservations" value={stats.active} hint={initial.my_active_reservations ? `${initial.my_active_reservations} are yours` : "Right now"} />
    </div>
  );
}
