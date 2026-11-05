"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { confirmCheckout } from "@/actions/scan";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import type { ReservationStatus, ScanResultCode } from "@/lib/types";

/**
 * Explicit confirmation step: scanning while checked in never releases the
 * seat on its own — the student has to confirm here.
 */
export function CheckoutConfirm({
  reservationId,
  token,
  facilityName,
  seatLabel,
  initialStatus,
  children,
}: {
  reservationId: string;
  token: string;
  facilityName: string;
  seatLabel: string | null;
  initialStatus: ReservationStatus;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ScanResultCode | null>(
    initialStatus === "CHECKED_OUT" || initialStatus === "EXPIRED" ? "ALREADY_CHECKED_OUT" : null,
  );
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    start(async () => {
      const res = await confirmCheckout(reservationId, token);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data.result);
      if (res.data.result === "CHECKED_OUT") {
        toast.success(`Checked out of ${facilityName}`);
        router.refresh();
      }
    });
  }

  if (result === "CHECKED_OUT") {
    return (
      <div className="flex animate-rise flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-full bg-ok-tint text-ok">
          <CircleCheck className="size-9" aria-hidden />
        </span>
        <h1 className="mt-4 text-[30px] leading-tight text-ink">You&apos;re checked out</h1>
        <p className="mt-1.5 max-w-sm text-[15px] text-muted">
          {seatLabel ? `Seat ${seatLabel}` : "Your place"} at {facilityName} is now free for another student. See you next time!
        </p>
        <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
          <ButtonLink href="/home" size="lg">Done</ButtonLink>
          <ButtonLink href={`/bookings/${reservationId}`} size="lg" variant="secondary">View booking</ButtonLink>
        </div>
      </div>
    );
  }

  const blocking: Partial<Record<ScanResultCode, { title: string; body: string }>> = {
    ALREADY_CHECKED_OUT: { title: "Already checked out", body: "This booking has already ended — nothing more to do." },
    NOT_CHECKED_IN: { title: "Not checked in", body: "This booking isn't checked in, so there's nothing to check out of." },
    WRONG_FACILITY: { title: "Wrong QR code", body: `That code belongs to a different space. Scan the ${facilityName} code to check out.` },
    INVALID_QR: { title: "Code not recognised", body: "That QR code isn't active any more. Scan the current code at the entrance." },
    RESERVATION_NOT_FOUND: { title: "Booking not found", body: "We couldn't find this booking on your account." },
  };
  const block = result ? blocking[result] : undefined;

  return (
    <div>
      <div className="flex flex-col items-center pb-6 pt-2 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-forest-tint text-forest">
          <LogOut className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-[30px] leading-tight text-ink">Leaving {facilityName}?</h1>
        <p className="mt-1.5 max-w-sm text-[15px] text-muted">
          Confirm check-out to release {seatLabel ? `seat ${seatLabel}` : "your place"} for other students. This can&apos;t be undone.
        </p>
      </div>
      {children}
      {block && (
        <Alert tone="warning" title={block.title} className="mt-5">
          {block.body}
        </Alert>
      )}
      {error && <Alert tone="error" className="mt-5">{error}</Alert>}
      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {!block ? (
          <>
            <Button size="lg" loading={pending} onClick={confirm} icon={<LogOut className="size-4.5" aria-hidden />}>
              Confirm check-out
            </Button>
            <ButtonLink href={`/bookings/${reservationId}`} size="lg" variant="secondary">
              I&apos;m staying
            </ButtonLink>
          </>
        ) : (
          <ButtonLink href="/bookings" size="lg" variant="secondary" className="sm:col-span-2">
            My bookings
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
