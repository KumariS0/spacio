"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { Availability } from "@/lib/types";
import { cn } from "@/lib/cn";

type LiveStatus = "connecting" | "live" | "reconnecting" | "offline";

type Ctx = {
  byId: Record<string, Availability>;
  status: LiveStatus;
  version: number;
  refresh: () => void;
};

const LiveCtx = createContext<Ctx | null>(null);

const POLL_MS = 60_000;

/**
 * Keeps availability for a set of facilities fresh.
 *  1. Subscribes to `facility_live` (a version counter bumped by DB triggers).
 *  2. On any bump, re-fetches counts through get_facility_availability — the
 *     database stays the source of truth and private rows are never streamed.
 *  3. Polls every minute and on focus/reconnect, so time-based changes (a slot
 *     starting, a no-show releasing a seat) also appear.
 */
export function LiveAvailabilityProvider({
  initial,
  facilityIds,
  children,
}: {
  initial: Availability[];
  facilityIds?: string[];
  children: ReactNode;
}) {
  const [byId, setById] = useState<Record<string, Availability>>(() => Object.fromEntries(initial.map((a) => [a.facility_id, a])));
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [version, setVersion] = useState(0);
  const idsKey = (facilityIds ?? []).slice().sort().join(",");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNow = useCallback(async () => {
    const supabase = getBrowserClient();
    const ids = idsKey ? idsKey.split(",") : null;
    const { data, error } = await supabase.rpc("get_facility_availability", { p_facility_ids: ids });
    if (error) {
      if (!navigator.onLine) setStatus("offline");
      return;
    }
    setById((prev) => ({ ...prev, ...Object.fromEntries((data as Availability[]).map((a) => [a.facility_id, a])) }));
    setVersion((v) => v + 1);
  }, [idsKey]);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fetchNow, 250);
  }, [fetchNow]);

  useEffect(() => {
    const supabase = getBrowserClient();
    const ids = idsKey ? new Set(idsKey.split(",")) : null;
    const channel = supabase
      .channel(`facility-live-${idsKey || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "facility_live" }, (payload) => {
        const row = (payload.new ?? payload.old) as { facility_id?: string } | null;
        if (!ids || (row?.facility_id && ids.has(row.facility_id))) refresh();
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("live");
          refresh(); // catch anything missed while (re)connecting
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus(navigator.onLine ? "reconnecting" : "offline");
        } else if (s === "CLOSED") {
          setStatus("reconnecting");
        }
      });

    const poll = setInterval(fetchNow, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    const onOnline = () => {
      setStatus("reconnecting");
      refresh();
    };
    const onOffline = () => setStatus("offline");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      supabase.removeChannel(channel);
    };
  }, [idsKey, fetchNow, refresh]);

  const value = useMemo(() => ({ byId, status, version, refresh }), [byId, status, version, refresh]);
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export function useLive() {
  return useContext(LiveCtx);
}

export function useAvailability(facilityId: string, fallback?: Availability) {
  const ctx = useContext(LiveCtx);
  return ctx?.byId[facilityId] ?? fallback;
}

export function LiveIndicator({ className }: { className?: string }) {
  const ctx = useContext(LiveCtx);
  if (!ctx) return null;
  const map: Record<LiveStatus, { text: string; dot: string }> = {
    connecting: { text: "Connecting…", dot: "bg-off" },
    live: { text: "Live", dot: "bg-ok animate-pulse" },
    reconnecting: { text: "Reconnecting… showing last known", dot: "bg-moderate-bar" },
    offline: { text: "Offline · showing last known", dot: "bg-busy" },
  };
  const s = map[ctx.status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted", className)} role="status" aria-live="polite">
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {s.text}
    </span>
  );
}
