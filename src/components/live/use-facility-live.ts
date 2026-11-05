"use client";

import { useEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Calls `onChange` whenever this facility's live version is bumped by the
 * database (booking, cancel, check-in/out, seat edits), plus every minute and
 * when the tab regains focus or the network returns.
 */
export function useFacilityLive(facilityId: string | null, onChange: () => void, pollMs = 60_000) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    if (!facilityId) return;
    const supabase = getBrowserClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => cb.current(), 200);
    };
    const channel = supabase
      .channel(`facility-${facilityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "facility_live", filter: `facility_id=eq.${facilityId}` }, fire)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fire();
      });
    const poll = setInterval(fire, pollMs);
    const onVisible = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", fire);
    return () => {
      if (t) clearTimeout(t);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", fire);
      supabase.removeChannel(channel);
    };
  }, [facilityId, pollMs]);
}
