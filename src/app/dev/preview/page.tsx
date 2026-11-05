import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, DemoNote, EmptyState, Stat } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { SpaceCard } from "@/components/spaces/space-card";
import { SeatGrid, SeatLegend } from "@/components/seats/seat-grid";
import { BookingCard } from "@/components/bookings/booking-card";
import { BookingPass } from "@/components/bookings/booking-pass";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { ActivityLogView } from "@/components/admin/activity-log";
import { isAssistantConfigured } from "@/lib/assistant/config";
import type { ActivityEvent, Availability, Facility, Reservation, ReservationStatus, SeatMapRow } from "@/lib/types";

export const metadata: Metadata = { title: "Component preview", robots: { index: false } };

/**
 * Development-only gallery with fixture data, so the design can be checked
 * without a Supabase project. Returns 404 in production builds.
 */
const base: Omit<Facility, "id" | "slug" | "name" | "category" | "booking_mode" | "capacity" | "image_url"> = {
  tagline: null,
  description: null,
  building_id: null,
  floor_label: "Ground floor",
  slot_minutes: 60,
  max_booking_minutes: 180,
  no_show_grace_minutes: 15,
  checkin_early_minutes: 15,
  rules: [],
  is_active: true,
  is_temporarily_closed: false,
  closure_note: null,
  lat: null,
  lng: null,
  map_x: null,
  map_y: null,
  is_demo: true,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  building: { id: "b1", name: "UB Building", code: null, map_x: 30, map_y: 40, lat: null, lng: null },
};
const facilities: Facility[] = [
  { ...base, id: "f1", slug: "central-library", name: "Central Library", category: "library", booking_mode: "seat", capacity: null, image_url: "/images/library.webp" },
  { ...base, id: "f2", slug: "fitness-centre", name: "Fitness Centre", category: "gym", booking_mode: "capacity", capacity: 100, image_url: "/images/gym.webp" },
  { ...base, id: "f3", slug: "study-commons", name: "Study Commons", category: "study_room", booking_mode: "capacity", capacity: 40, image_url: null },
];
const avail: Record<string, Availability> = {
  f1: { facility_id: "f1", booking_mode: "seat", capacity: 24, occupied: 5, reserved: 3, available: 16, unavailable: 1, is_open_now: true, opens_at: "08:00:00", closes_at: "22:00:00" },
  f2: { facility_id: "f2", booking_mode: "capacity", capacity: 100, occupied: 52, reserved: 10, available: 38, unavailable: 0, is_open_now: true, opens_at: "06:00:00", closes_at: "21:00:00" },
  f3: { facility_id: "f3", booking_mode: "capacity", capacity: 40, occupied: 33, reserved: 5, available: 2, unavailable: 0, is_open_now: false, opens_at: "09:00:00", closes_at: "18:00:00" },
};
const states: SeatMapRow["state"][] = ["available", "available", "reserved", "occupied", "available", "unavailable"];
const seats: SeatMapRow[] = ["A", "B", "C"].flatMap((row, r) =>
  Array.from({ length: 6 }, (_, c) => ({
    seat_id: `${row}${c}`,
    label: `${row}0${c + 1}`,
    row_label: row,
    col_index: c + 1,
    seat_status: "active" as const,
    state: states[(r * 2 + c) % states.length],
    is_mine: r === 1 && c === 4,
  })),
);
const soon = new Date(Date.now() + 2 * 3600_000);
soon.setMinutes(0, 0, 0);
const reservation: Reservation = {
  id: "8a1f3c2e-0000-4000-8000-000000000000",
  user_id: "u1",
  facility_id: "f1",
  seat_id: "B4",
  starts_at: soon.toISOString(),
  ends_at: new Date(soon.getTime() + 2 * 3600_000).toISOString(),
  status: "BOOKED",
  checked_in_at: null,
  checked_out_at: null,
  cancelled_at: null,
  cancelled_by: null,
  cancel_reason: null,
  created_at: new Date().toISOString(),
  pass_token: "Zq3k9_X-2bVt7LmNp4RsWy8hJcFdA1uE6oTgKiHvB0x",
  facility: { id: "f1", slug: "central-library", name: "Central Library", image_url: "/images/library.webp", category: "library", floor_label: "Ground floor", booking_mode: "seat", checkin_early_minutes: 15, no_show_grace_minutes: 15, building: { name: "UB Building" } },
  seat: { label: "B05" },
};
const PREVIEW_NOW = Date.now();
const minsAgo = (m: number) => new Date(PREVIEW_NOW - m * 60_000).toISOString();
const ev = (m: number, kind: ActivityEvent["kind"], name: string, facility: string, seat: string | null): ActivityEvent => ({
  event_at: minsAgo(m),
  kind,
  reservation_id: `${name}-${m}`,
  student_name: name,
  student_email: `${name.split(" ")[0].toLowerCase()}@demo.spacio.invalid`,
  is_demo: true,
  facility_name: facility,
  facility_slug: facility.toLowerCase().replace(/ /g, "-"),
  building_name: "UB Building",
  floor_label: "Ground floor",
  seat_label: seat,
});
const activity: ActivityEvent[] = [
  ev(0, "in", "Ananya Rao", "Computer Lab", null),
  ev(9, "in", "Rohan Das", "Reading Room", "A05"),
  ev(22, "in", "Kabir Singh", "Study Commons", null),
  ev(33, "out", "Kabir Singh", "Central Library", "B04"),
  ev(56, "in", "Aarav Sharma", "Central Library", "A02"),
  ev(64, "out", "Meera Iyer", "Fitness Centre", null),
  ev(120, "auto_out", "Sara Thomas", "Reading Room", "B02"),
];

const STATUSES: ReservationStatus[] = ["BOOKED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "EXPIRED", "NO_SHOW"];

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="main" className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <Badge>Development preview · fixture data</Badge>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl">Space cards</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f, i) => (
            <SpaceCard key={f.id} facility={f} availability={avail[f.id]} isFavorite={i === 0} priority={i < 2} />
          ))}
        </div>
        <DemoNote />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <h2 className="text-2xl">Seat map</h2>
          <SeatLegend />
          <SeatGrid seats={seats} readOnly />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl">Booking card</h2>
          <BookingCard reservation={reservation} />
          <h2 className="pt-4 text-2xl">Booking pass</h2>
          <BookingPass reservation={reservation} />
          <BookingPass reservation={{ ...reservation, status: "CHECKED_IN", checked_in_at: reservation.starts_at }} />
          <div className="flex flex-wrap gap-2 pt-2">
            {STATUSES.map((s) => <StatusBadge key={s} status={s} />)}
          </div>
        </div>
      </section>

      <section className="max-w-md space-y-3">
        <h2 className="text-2xl">Check-in log (admin)</h2>
        <ActivityLogView events={activity} now={PREVIEW_NOW} />
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Stats, alerts and buttons</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Free seats right now" value="16" hint="of 24 in Central Library" />
          <Stat label="Checked in" value="57" />
          <Stat label="Your bookings this week" value="3" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info" title="Check-in opens 15 minutes before">Scan the QR code at the entrance.</Alert>
          <Alert tone="success" title="Checked in">Enjoy your session.</Alert>
          <Alert tone="warning">The seat you picked was just taken.</Alert>
          <Alert tone="error">This code isn’t a SPACIO code.</Alert>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
        </div>
        <Card className="p-0">
          <EmptyState title="No upcoming bookings">Find a space and reserve a spot.</EmptyState>
        </Card>
      </section>

      <AssistantWidget configured={isAssistantConfigured()} />
    </main>
  );
}
