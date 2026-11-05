"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { rotateQr } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogRoot, DialogTrigger } from "@/components/ui/dialog";

export function RotateQrButton({ facilityId, name, hasCode }: { facilityId: string; name: string; hasCode: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const r = await rotateQr(facilityId);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(r?.message ?? "Done");
        setOpen(false);
      }
    });

  if (!hasCode) {
    return (
      <Button size="sm" variant="secondary" loading={pending} onClick={run} icon={<RefreshCw className="size-4" aria-hidden />}>
        Create code
      </Button>
    );
  }
  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" aria-hidden />}>Replace</Button>
      </DialogTrigger>
      <DialogContent title={`Replace the QR code for ${name}?`} description="The printed code stops working immediately. Print the new one and swap it at the entrance. Existing bookings aren’t affected.">
        <div className="grid grid-cols-2 gap-3">
          <DialogClose asChild><Button variant="secondary" size="lg">Keep current</Button></DialogClose>
          <Button variant="danger" size="lg" loading={pending} onClick={run}>Replace code</Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
