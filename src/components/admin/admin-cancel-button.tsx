"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adminCancelReservation } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { DialogClose, DialogContent, DialogRoot, DialogTrigger } from "@/components/ui/dialog";

export function AdminCancelButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-busy hover:text-busy">Cancel</Button>
      </DialogTrigger>
      <DialogContent title="Cancel this reservation?" description={`${label}. The student will see it as cancelled by staff, and the seat or place is released.`}>
        <Field label="Reason (shown to the student)" htmlFor={`reason-${id}`} optional className="mb-4">
          <Input id={`reason-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Library closed for an exam" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <DialogClose asChild><Button variant="secondary" size="lg">Keep it</Button></DialogClose>
          <Button
            variant="danger"
            size="lg"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await adminCancelReservation(id, reason.trim());
                if (r?.error) toast.error(r.error);
                else {
                  toast.success(r?.message ?? "Cancelled");
                  setOpen(false);
                }
              })
            }
          >
            Cancel reservation
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
