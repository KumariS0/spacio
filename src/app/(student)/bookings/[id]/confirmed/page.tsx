import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getMyReservation } from "@/lib/data";
import { ReservationDetails } from "@/components/bookings/reservation-details";
import { CheckinSteps } from "@/components/bookings/checkin-steps";
import { ButtonLink } from "@/components/ui/button";
import { BookingPass } from "@/components/bookings/booking-pass";
import { Card } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Booking confirmed" };

export default async function ConfirmedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getMyReservation(id);
  if (!r) notFound();
  // Only a real, live reservation read back from the database is shown as confirmed.
  const confirmed = r.status === "BOOKED" || r.status === "CHECKED_IN";

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex animate-rise flex-col items-center pb-6 pt-2 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-ok-tint text-ok">
          <Check className="size-8" aria-hidden strokeWidth={2.5} />
        </span>
        <h1 className="mt-4 text-[30px] leading-tight text-ink">{confirmed ? "Booking confirmed" : "Booking updated"}</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          {r.facility?.name}
          {r.seat?.label ? ` · Seat ${r.seat.label}` : ""}
        </p>
      </div>

      {confirmed && <BookingPass reservation={r} className="mb-6" />}

      <ReservationDetails reservation={r} />

      {confirmed && (
        <Card as="section" className="mt-6 p-5">
          <h2 className="mb-4 font-serif text-xl text-ink">What happens next</h2>
          <CheckinSteps reservation={r} />
        </Card>
      )}

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        <ButtonLink href={`/bookings/${r.id}`} size="lg">
          View booking
        </ButtonLink>
        <ButtonLink href="/bookings" size="lg" variant="secondary">
          All my bookings
        </ButtonLink>
      </div>
    </div>
  );
}
