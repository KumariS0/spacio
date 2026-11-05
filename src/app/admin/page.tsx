import type { Metadata } from "next";
import { getAvailability, getSupabase, requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { Stat } from "@/components/ui/misc";
import { LiveAvailabilityProvider, LiveIndicator } from "@/components/live/live-availability";
import { LiveOccupancyTable } from "@/components/admin/live-occupancy-table";
import { SweepButton } from "@/components/admin/sweep-button";
import { ActivityLog } from "@/components/admin/activity-log";
import type { ActivityEvent, AdminStats, Facility } from "@/lib/types";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverview() {
  await requireAdmin();
  const supabase = await getSupabase();
  const [{ data: stats }, { data: facilities }, availability, { data: activity }] = await Promise.all([
    supabase.rpc("get_admin_stats"),
    supabase.from("facilities").select("id, slug, name, booking_mode, is_active, is_temporarily_closed, category").order("name"),
    getAvailability(),
    supabase.rpc("admin_recent_activity", { p_limit: 30 }),
  ]);
  if (!stats) throw new Error("Could not load admin statistics.");
  const s = stats as AdminStats;

  return (
    <LiveAvailabilityProvider initial={availability}>
      <PageHeader title="Overview" description="Live occupancy and reservation activity across all facilities." actions={<SweepButton />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active facilities" value={s.total_facilities} hint={`${s.inactive_facilities} inactive · ${s.bookable_facilities} bookable`} />
        <Stat label="Total capacity" value={s.total_capacity} hint={`${s.seats_in_maintenance} seats out of service`} />
        <Stat label="Checked in now" value={s.occupied} hint={`${s.reserved} more reserved now`} />
        <Stat label="Available now" value={s.available} hint="Seats + capacity places" />
        <Stat label="Upcoming bookings" value={s.upcoming_reservations} />
        <Stat label="Check-outs (24 h)" value={s.checkouts_24h} />
        <Stat label="No-shows (24 h)" value={s.no_show_24h} />
        <Stat label="Expired (24 h)" value={s.expired_24h} hint="Checked in, never scanned out" />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <section aria-labelledby="occ-title">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="occ-title" className="text-xl text-ink">Facility occupancy</h2>
            <LiveIndicator />
          </div>
          <LiveOccupancyTable facilities={(facilities ?? []) as Pick<Facility, "id" | "slug" | "name" | "booking_mode" | "is_active" | "is_temporarily_closed" | "category">[]} />
        </section>
        <section aria-labelledby="log-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="log-title" className="text-xl text-ink">Check-in log</h2>
            <span className="text-xs text-muted">Who scanned in and out, and where</span>
          </div>
          <ActivityLog initial={(activity ?? []) as ActivityEvent[]} />
        </section>
      </div>
    </LiveAvailabilityProvider>
  );
}
