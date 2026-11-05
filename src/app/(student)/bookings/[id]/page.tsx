import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMyReservation } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ReservationDetails } from "@/components/bookings/reservation-details";
import { CheckinSteps } from "@/components/bookings/checkin-steps";
import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import { ButtonLink } from "@/components/ui/button";
import { BookingPass } from "@/components/bookings/booking-pass";
import { Alert, Card } from "@/components/ui/misc";
import { formatDay, formatRange } from "@/lib/time";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // RLS: only the owner (or an admin) can read this row.
  const r = await getMyReservation(id);
  if (!r) notFound();
  const live = r.status === "BOOKED" || r.status === "CHECKED_IN";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        backHref="/bookings"
        backLabel="My bookings"
        title={r.facility?.name ?? "Booking"}
        description={r.seat?.label ? `Seat ${r.seat.label}` : r.facility?.booking_mode === "capacity" ? "General admission" : undefined}
        actions={<StatusBadge status={r.status} />}
      />

      {r.status === "NO_SHOW" && (
        <Alert tone="warning" title="Missed check-in" className="mb-5">
          This booking wasn&apos;t checked into in time, so the place was released for other students.
        </Alert>
      )}
      {r.status === "CANCELLED" && (
        <Alert tone="info" className="mb-5">
          This booking was cancelled{r.cancel_reason ? ` by an administrator: ${r.cancel_reason}` : ""}.
        </Alert>
      )}

      {live && <BookingPass reservation={r} className="mb-6" />}

      <ReservationDetails reservation={r} />

      {live && (
        <Card as="section" className="mt-6 p-5">
          <h2 className="mb-4 font-serif text-xl text-ink">{r.status === "CHECKED_IN" ? "While you're here" : "When you arrive"}</h2>
          <CheckinSteps reservation={r} />
          {r.status === "BOOKED" && (
            <div className="mt-6">
              <CancelBookingButton
                reservationId={r.id}
                className="h-12 w-full sm:w-auto"
                summary={`${r.facility?.name}${r.seat?.label ? `, seat ${r.seat.label}` : ""} · ${formatDay(r.starts_at)}, ${formatRange(r.starts_at, r.ends_at)}. Your place will be released for other students.`}
              />
            </div>
          )}
        </Card>
      )}

      {r.facility && (
        <ButtonLink href={`/spaces/${r.facility.slug}`} variant="ghost" className="mt-5">
          View {r.facility.name}
        </ButtonLink>
      )}
    </div>
  );
}
