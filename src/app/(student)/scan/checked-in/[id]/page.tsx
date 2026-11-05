import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, LogOut } from "lucide-react";
import { getMyReservation } from "@/lib/data";
import { ReservationDetails } from "@/components/bookings/reservation-details";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/misc";
import { formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Checked in" };

export default async function CheckedInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getMyReservation(id);
  if (!r) notFound();

  if (r.status !== "CHECKED_IN") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert tone="info" title="This booking isn't checked in">
          It&apos;s currently {r.status.toLowerCase().replace("_", " ")}. Open your booking for details.
        </Alert>
        <ButtonLink href={`/bookings/${r.id}`} variant="secondary">View booking</ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex animate-rise flex-col items-center pb-6 pt-2 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-ok-tint text-ok">
          <CircleCheck className="size-9" aria-hidden />
        </span>
        <h1 className="mt-4 text-[30px] leading-tight text-ink">You’re checked in at {r.facility?.name}</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          {r.seat?.label ? `Seat ${r.seat.label} is yours` : "Your place is held"} until {formatTime(r.ends_at)}.
        </p>
      </div>
      <ReservationDetails reservation={r} />
      <Card className="mt-6 flex gap-3.5 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest-tint text-forest">
          <LogOut className="size-4.5" aria-hidden />
        </span>
        <p className="text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Leaving early?</span> Scan the same QR code on your way out and confirm — your
          {r.seat?.label ? " seat" : " place"} is released straight away for other students.
        </p>
      </Card>
      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        <ButtonLink href="/home" size="lg">Done</ButtonLink>
        <ButtonLink href={`/bookings/${r.id}`} size="lg" variant="secondary">View booking</ButtonLink>
      </div>
    </div>
  );
}
