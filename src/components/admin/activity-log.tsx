"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogIn, LogOut, TimerOff } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { useLive } from "@/components/live/live-availability";
import { formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { ActivityEvent } from "@/lib/types";

const KIND = {
  in: { verb: "checked in at", icon: LogIn, tone: "bg-ok-tint text-ok" },
  out: { verb: "checked out of", icon: LogOut, tone: "bg-sunken text-ink-soft" },
  auto_out: { verb: "left without checking out of", icon: TimerOff, tone: "bg-moderate-tint text-moderate-ink" },
} as const;

function ago(iso: string, now: number) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min ` : ""}ago`;
  return formatDateTime(iso);
}

/** Presentational log list — also used by the dev preview with fixture data. */
export function ActivityLogView({ events, now, error, className }: { events: ActivityEvent[]; now: number; error?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-card border border-line bg-surface", className)}>
      {error && <p role="status" className="border-b border-line bg-moderate-tint px-4 py-2 text-xs text-moderate-ink">Couldn’t refresh — showing the last loaded entries.</p>}
      {events.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">No check-ins yet. Scans appear here as they happen.</p>
      ) : (
        <ol className="max-h-[26rem] divide-y divide-line overflow-y-auto overscroll-contain" aria-label="Recent check-ins and check-outs">
          {events.map((e) => {
            const k = KIND[e.kind];
            const Icon = k.icon;
            const where = [e.seat_label && `Seat ${e.seat_label}`, e.building_name, e.floor_label].filter(Boolean).join(" · ");
            return (
              <li key={`${e.reservation_id}-${e.kind}`} className="flex gap-3 px-4 py-3">
                <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", k.tone)} aria-hidden>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-ink">
                    <span className="font-medium" title={e.student_email}>{e.student_name || e.student_email}</span>{" "}
                    <span className="text-ink-soft">{k.verb}</span>{" "}
                    <Link href={`/spaces/${e.facility_slug}`} className="font-medium text-forest underline-offset-2 hover:underline">{e.facility_name}</Link>
                  </p>
                  {(where || e.is_demo) && (
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                      {e.is_demo && <span className="shrink-0 rounded-full bg-sunken px-1.5 text-[10px] font-medium" title="Fictional student from the demo seed">demo</span>}
                      <span className="truncate">{where}</span>
                    </p>
                  )}
                </div>
                <time dateTime={e.event_at} title={formatDateTime(e.event_at)} className="shrink-0 pt-0.5 text-right text-xs tabular text-muted" suppressHydrationWarning>
                  {formatTime(e.event_at)}
                  <span className="block text-[11px]" suppressHydrationWarning>{ago(e.event_at, now)}</span>
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * Live check-in / check-out log for admins. Refreshes whenever the live
 * availability signal changes (any booking or scan) and every 30 seconds.
 */
export function ActivityLog({ initial, className }: { initial: ActivityEvent[]; className?: string }) {
  const [events, setEvents] = useState(initial);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const version = useLive()?.version ?? 0;

  useEffect(() => {
    let current = true;
    const load = () =>
      getBrowserClient()
        .rpc("admin_recent_activity", { p_limit: 30 })
        .then(({ data, error: err }) => {
          if (!current) return;
          setError(Boolean(err));
          if (data) setEvents(data as ActivityEvent[]);
          setNow(Date.now());
        });
    if (version > 0) load();
    const id = setInterval(load, 30_000);
    return () => {
      current = false;
      clearInterval(id);
    };
  }, [version]);

  return <ActivityLogView events={events} now={now} error={error} className={className} />;
}
