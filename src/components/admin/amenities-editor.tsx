"use client";

import { useActionState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { addAmenity, removeAmenity } from "@/actions/admin";
import type { FormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ICON_NAMES, iconFor } from "@/components/spaces/facility-icon";
import type { Amenity } from "@/lib/types";

export function AmenitiesEditor({ facilityId, amenities }: { facilityId: string; amenities: Amenity[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addAmenity, null);
  const [removing, start] = useTransition();
  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2">
        {amenities.map((a) => {
          const Icon = iconFor(a.icon);
          return (
            <li key={a.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-3 pr-1 text-sm">
              <Icon className="size-4 text-forest" aria-hidden /> {a.label}
              <button
                type="button"
                disabled={removing}
                onClick={() => start(async () => { const r = await removeAmenity(a.id, facilityId); if (r?.error) toast.error(r.error); })}
                className="grid size-6 place-items-center rounded-full text-muted hover:bg-sunken hover:text-busy"
                aria-label={`Remove ${a.label}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
        {amenities.length === 0 && <li className="text-sm text-muted">No amenities yet.</li>}
      </ul>
      <form action={action} className="flex flex-wrap items-start gap-2">
        <input type="hidden" name="facility_id" value={facilityId} />
        <label htmlFor="amenity-label" className="sr-only">Amenity</label>
        <Input id="amenity-label" name="label" placeholder="e.g. Wi-Fi" className="h-10 w-48" maxLength={60} required />
        <label htmlFor="amenity-icon" className="sr-only">Icon</label>
        <Select id="amenity-icon" name="icon" defaultValue="check" className="h-10 w-44">
          {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <Button type="submit" variant="quiet" className="h-10" loading={pending}>Add</Button>
        {state?.fieldErrors?.label && <p className="w-full text-sm text-busy">{state.fieldErrors.label}</p>}
        {state?.error && <p className="w-full text-sm text-busy">{state.error}</p>}
      </form>
    </div>
  );
}
