import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, History } from "lucide-react";
import { getMyReservations } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { BookingCard } from "@/components/bookings/booking-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import type { Reservation } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "My bookings" };

const TABS = [
  { key: "current", label: "Current & upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled & missed" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function group(rs: Reservation[]) {
  const now = Date.now();
  const active = rs.filter((r) => r.status === "CHECKED_IN");
  const upcoming = rs
    .filter((r) => r.status === "BOOKED" && new Date(r.ends_at).getTime() > now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const completed = rs.filter((r) => r.status === "CHECKED_OUT" || r.status === "EXPIRED");
  const cancelled = rs.filter((r) => r.status === "CANCELLED" || r.status === "NO_SHOW");
  return { active, upcoming, completed, cancelled };
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : "current";
  const reservations = await getMyReservations();
  const g = group(reservations);
  const counts: Record<Tab, number> = { current: g.active.length + g.upcoming.length, completed: g.completed.length, cancelled: g.cancelled.length };

  return (
    <div>
      <PageHeader
        title="My bookings"
        description="Your reservations, check-ins and history."
        actions={
          <ButtonLink href="/bookings/history" variant="secondary" size="sm" icon={<History className="size-4" aria-hidden />}>
            History
          </ButtonLink>
        }
      />

      <nav aria-label="Booking filters" className="no-scrollbar -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "current" ? "/bookings" : `/bookings?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "relative shrink-0 px-3 pb-3 pt-1 text-sm transition-colors",
              tab === t.key ? "font-semibold text-forest" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
            <span className="tabular ml-1.5 rounded-full bg-sunken px-1.5 py-0.5 text-[11px] text-ink-soft">{counts[t.key]}</span>
            {tab === t.key && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-forest" />}
          </Link>
        ))}
      </nav>

      {tab === "current" && (
        <div className="space-y-8">
          {g.active.length > 0 && (
            <section aria-labelledby="active-title">
              <h2 id="active-title" className="mb-3 text-lg text-ink">Checked in now</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {g.active.map((r) => <li key={r.id}><BookingCard reservation={r} /></li>)}
              </ul>
            </section>
          )}
          <section aria-labelledby="upcoming-title">
            <h2 id="upcoming-title" className="mb-3 text-lg text-ink">Upcoming</h2>
            {g.upcoming.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {g.upcoming.map((r) => <li key={r.id}><BookingCard reservation={r} /></li>)}
              </ul>
            ) : (
              <EmptyState icon={<CalendarDays className="size-5" aria-hidden />} title="No upcoming bookings" action={<ButtonLink href="/explore">Find a space</ButtonLink>}>
                Reserve a library seat or a gym slot and it will show up here.
              </EmptyState>
            )}
          </section>
        </div>
      )}

      {tab !== "current" && (
        (tab === "completed" ? g.completed : g.cancelled).length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {(tab === "completed" ? g.completed : g.cancelled).map((r) => <li key={r.id}><BookingCard reservation={r} /></li>)}
          </ul>
        ) : (
          <EmptyState icon={<History className="size-5" aria-hidden />} title={tab === "completed" ? "Nothing completed yet" : "Nothing here"}>
            {tab === "completed" ? "Bookings you check out of appear here." : "Cancelled bookings and missed check-ins appear here."}
          </EmptyState>
        )
      )}
    </div>
  );
}
