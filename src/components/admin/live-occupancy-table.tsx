"use client";

import Link from "next/link";
import { useLive } from "@/components/live/live-availability";
import { occupancyLevel, occupancyPercent } from "@/lib/occupancy";
import type { Facility } from "@/lib/types";
import { cn } from "@/lib/cn";

const bar = { plenty: "bg-ok", moderate: "bg-moderate-bar", busy: "bg-busy", full: "bg-busy", none: "bg-off" };

export function LiveOccupancyTable({ facilities }: { facilities: Pick<Facility, "id" | "slug" | "name" | "booking_mode" | "is_active" | "is_temporarily_closed" | "category">[] }) {
  const live = useLive();
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-paper/60 text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Facility</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Capacity</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">In</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Reserved</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Free</th>
            <th scope="col" className="w-48 px-4 py-2.5 font-medium">Occupancy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {facilities.map((f) => {
            const a = live?.byId[f.id];
            const pct = occupancyPercent(a?.capacity, a?.available);
            const level = occupancyLevel(f.booking_mode === "none" ? null : pct);
            return (
              <tr key={f.id} className={cn(!f.is_active && "opacity-55")}>
                <td className="px-4 py-3">
                  <Link href={`/admin/facilities/${f.id}`} className="font-medium text-ink hover:text-forest hover:underline">{f.name}</Link>
                  {!f.is_active && <span className="ml-2 text-xs text-muted">Inactive</span>}
                  {f.is_temporarily_closed && <span className="ml-2 text-xs text-moderate">Closed</span>}
                  {a && f.booking_mode !== "none" && <span className={cn("ml-2 text-xs", a.is_open_now ? "text-ok" : "text-muted")}>{a.is_open_now ? "Open" : "Outside hours"}</span>}
                </td>
                <td className="px-4 py-3 text-ink-soft">{f.booking_mode === "seat" ? "Seats" : f.booking_mode === "capacity" ? "Capacity" : "Location"}</td>
                <td className="tabular px-4 py-3 text-right">{a?.capacity ?? "—"}</td>
                <td className="tabular px-4 py-3 text-right">{f.booking_mode === "none" ? "—" : a?.occupied ?? 0}</td>
                <td className="tabular px-4 py-3 text-right">{f.booking_mode === "none" ? "—" : a?.reserved ?? 0}</td>
                <td className="tabular px-4 py-3 text-right font-medium">{a?.available ?? "—"}</td>
                <td className="px-4 py-3">
                  {pct != null && f.booking_mode !== "none" ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                        <div className={cn("h-full rounded-full transition-[width] duration-500", bar[level])} style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="tabular w-9 text-right text-xs text-muted">{pct}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
