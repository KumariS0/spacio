"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBuilding, saveBuilding } from "@/actions/admin";
import type { FormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Card, EmptyState } from "@/components/ui/misc";
import { DialogClose, DialogContent, DialogRoot, DialogTrigger } from "@/components/ui/dialog";
import type { Building } from "@/lib/types";

export function BuildingManager({ buildings, facilityCounts }: { buildings: Building[]; facilityCounts: Record<string, number> }) {
  const [editing, setEditing] = useState<Building | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-label="Buildings">
        {buildings.length === 0 ? (
          <EmptyState title="No buildings yet">Add a building on the right, then assign facilities to it.</EmptyState>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {buildings.map((b) => (
              <li key={b.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {b.name} {b.code && <span className="ml-1 text-xs font-normal text-muted">{b.code}</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {facilityCounts[b.id] ?? 0} facilit{(facilityCounts[b.id] ?? 0) === 1 ? "y" : "ies"}
                    {b.map_x != null && b.map_y != null && ` · map ${b.map_x}%, ${b.map_y}%`}
                    {b.lat != null && " · verified coordinates"}
                    {b.is_demo && " · demo data"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setEditing(b)}>Edit</Button>
                <DialogRoot>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${b.name}`} icon={<Trash2 className="size-3.5" aria-hidden />} />
                  </DialogTrigger>
                  <DialogContent title={`Delete ${b.name}?`} description="Facilities in this building stay, but lose their building and map position.">
                    <div className="grid grid-cols-2 gap-3">
                      <DialogClose asChild><Button variant="secondary" size="lg">Cancel</Button></DialogClose>
                      <DialogClose asChild>
                        <Button
                          variant="danger"
                          size="lg"
                          loading={pending}
                          onClick={() => start(async () => { const r = await deleteBuilding(b.id); if (r?.error) toast.error(r.error); else { toast.success(r?.message ?? "Deleted"); if (editing?.id === b.id) setEditing(null); } })}
                        >
                          Delete
                        </Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </DialogRoot>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Card className="p-5 lg:sticky lg:top-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">{editing ? `Edit ${editing.name}` : "Add building"}</h2>
          {editing && <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>New instead</Button>}
        </div>
        <BuildingForm key={editing?.id ?? "new"} building={editing} onSaved={() => setEditing(null)} />
      </Card>
    </div>
  );
}

function BuildingForm({ building, onSaved }: { building: Building | null; onSaved: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await saveBuilding(prev, fd);
    if (r?.message) {
      toast.success(r.message);
      onSaved();
    }
    return r;
  }, null);
  const v = state?.values;
  const val = (k: keyof Building) => v?.[k as string] ?? (building?.[k] != null ? String(building[k]) : "");
  return (
    <form action={action} className="space-y-4">
      {building && <input type="hidden" name="id" value={building.id} />}
      <Field label="Name" htmlFor="b-name">
        <Input id="b-name" name="name" defaultValue={val("name")} required />
      </Field>
      <Field label="Short code" htmlFor="b-code" optional>
        <Input id="b-code" name="code" defaultValue={val("code")} maxLength={20} />
      </Field>
      <Field label="Description" htmlFor="b-desc" optional>
        <Textarea id="b-desc" name="description" defaultValue={val("description")} rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Map X %" htmlFor="b-x" optional>
          <Input id="b-x" name="map_x" type="number" min={0} max={100} step="0.1" defaultValue={val("map_x")} />
        </Field>
        <Field label="Map Y %" htmlFor="b-y" optional>
          <Input id="b-y" name="map_y" type="number" min={0} max={100} step="0.1" defaultValue={val("map_y")} />
        </Field>
        <Field label="Latitude" htmlFor="b-lat" optional>
          <Input id="b-lat" name="lat" type="number" step="any" defaultValue={val("lat")} />
        </Field>
        <Field label="Longitude" htmlFor="b-lng" optional>
          <Input id="b-lng" name="lng" type="number" step="any" defaultValue={val("lng")} />
        </Field>
      </div>
      <Checkbox name="is_demo" label="Demonstration data" defaultChecked={v ? v.is_demo === "on" : building?.is_demo ?? false} />
      {state?.error && <p role="alert" className="text-sm text-busy">{state.error}</p>}
      <Button type="submit" loading={pending} className="w-full">{building ? "Save building" : "Add building"}</Button>
    </form>
  );
}
