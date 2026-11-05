"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteFacility, setFacilityActive } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogRoot, DialogTrigger } from "@/components/ui/dialog";

export function FacilityDangerZone({ facilityId, active, name }: { facilityId: string; active: boolean; name: string }) {
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="danger-title" className="mt-6 rounded-card border border-busy/25 bg-busy-tint/40 p-5">
      <h2 id="danger-title" className="font-serif text-lg text-ink">Remove from SPACIO</h2>
      <p className="mt-1 text-sm text-muted">
        Deactivating hides the facility from students but keeps its booking history. Deleting is only possible when it has no reservations.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={pending}
          onClick={() => start(async () => { const r = await setFacilityActive(facilityId, !active); if (r?.error) toast.error(r.error); else toast.success(r?.message ?? "Updated"); })}
        >
          {active ? "Deactivate" : "Activate"}
        </Button>
        <DialogRoot>
          <DialogTrigger asChild>
            <Button variant="danger">Delete permanently</Button>
          </DialogTrigger>
          <DialogContent title={`Delete ${name}?`} description="Seats, QR codes, hours and favourites for this facility are deleted too. This can't be undone.">
            <div className="grid grid-cols-2 gap-3">
              <DialogClose asChild><Button variant="secondary" size="lg">Cancel</Button></DialogClose>
              <Button variant="danger" size="lg" loading={pending} onClick={() => start(async () => { const r = await deleteFacility(facilityId); if (r?.error) toast.error(r.error); })}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </DialogRoot>
      </div>
    </section>
  );
}
