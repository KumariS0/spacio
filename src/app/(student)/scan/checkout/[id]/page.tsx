import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMyReservation } from "@/lib/data";
import { isValidToken } from "@/lib/qr";
import { ReservationDetails } from "@/components/bookings/reservation-details";
import { CheckoutConfirm } from "@/components/scan/checkout-confirm";
import { Alert } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Check out" };

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getMyReservation(id);
  if (!r) notFound();

  if (!t || !isValidToken(t)) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert tone="info" title="Scan the QR code to check out">
          To make sure you&apos;re at {r.facility?.name}, check-out happens by scanning the QR code at the entrance.
        </Alert>
        <ButtonLink href="/scan">Open scanner</ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <CheckoutConfirm
        reservationId={r.id}
        token={t}
        facilityName={r.facility?.name ?? "this space"}
        seatLabel={r.seat?.label ?? null}
        initialStatus={r.status}
      >
        <ReservationDetails reservation={r} />
      </CheckoutConfirm>
    </div>
  );
}
