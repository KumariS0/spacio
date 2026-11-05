"use client";

import { useCallback, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { useFacilityLive } from "@/components/live/use-facility-live";
import type { SeatMapRow } from "@/lib/types";
import { SeatGrid, SeatLegend } from "./seat-grid";

/** Read-only "right now" seat layout on the facility details page. */
export function LiveSeatMap({ facilityId, initial }: { facilityId: string; initial: SeatMapRow[] }) {
  const [seats, setSeats] = useState(initial);
  const reload = useCallback(async () => {
    const { data, error } = await getBrowserClient().rpc("get_seat_map", { p_facility_id: facilityId });
    if (!error && data) setSeats(data as SeatMapRow[]);
  }, [facilityId]);
  useFacilityLive(facilityId, reload);

  const counts = seats.reduce<Record<string, number>>((acc, s) => ((acc[s.state] = (acc[s.state] ?? 0) + 1), acc), {});
  return (
    <div className="space-y-3">
      <SeatGrid seats={seats} readOnly />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SeatLegend />
        <p className="tabular text-xs text-muted" aria-live="polite">
          {counts.available ?? 0} available · {counts.reserved ?? 0} reserved · {counts.occupied ?? 0} occupied
        </p>
      </div>
    </div>
  );
}
