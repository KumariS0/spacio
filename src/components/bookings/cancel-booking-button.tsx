"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX } from "lucide-react";
import { toast } from "sonner";
import { cancelBooking } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogRoot, DialogTrigger } from "@/components/ui/dialog";

export function CancelBookingButton({ reservationId, summary, className }: { reservationId: string; summary: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function confirm() {
    start(async () => {
      const res = await cancelBooking(reservationId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Booking cancelled. Your place has been released.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className={className} icon={<CalendarX className="size-4.5" aria-hidden />}>
          Cancel booking
        </Button>
      </DialogTrigger>
      <DialogContent title="Cancel this booking?" description={summary} icon={<CalendarX className="size-6" aria-hidden />}>
        <div className="grid grid-cols-2 gap-3">
          <DialogClose asChild>
            <Button variant="secondary" size="lg">Keep it</Button>
          </DialogClose>
          <Button variant="danger" size="lg" loading={pending} onClick={confirm}>
            Cancel booking
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
