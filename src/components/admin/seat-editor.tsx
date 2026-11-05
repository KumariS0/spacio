"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteSeats, generateSeats, saveSeat, setSeatsStatus } from "@/actions/admin";
import type { FormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Card, EmptyState } from "@/components/ui/misc";
import { DialogClose, DialogContent, DialogRoot, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import type { Seat, SeatState } from "@/lib/types";

const STATUS_STYLE: Record<Seat["status"], string> = {
  active: "border-ok/50 bg-ok-tint text-ok-ink",
  maintenance: "border-dashed border-moderate/70 bg-moderate-tint text-moderate-ink",
  disabled: "border-dashed border-off/60 bg-off-tint text-off-ink line-through",
};

function report(r: FormState) {
  if (r?.error) toast.error(r.error);
  else if (r?.message) toast.success(r.message);
}

export function SeatEditor({ facilityId, seats, liveState }: { facilityId: string; seats: Seat[]; liveState: Record<string, SeatState> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [genRows, setGenRows] = useState("4");
  const [genCols, setGenCols] = useState("6");

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Ignore selections for seats that no longer exist after a refresh.
  const ids = [...selected].filter((id) => seats.some((s) => s.id === id));
  const single = ids.length === 1 ? seats.find((s) => s.id === ids[0]) : undefined;
  const rows = new Map<string, Seat[]>();
  for (const s of seats) rows.set(s.row_label, [...(rows.get(s.row_label) ?? []), s]);
  const sortedRows = [...rows.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const maxCol = Math.max(1, ...seats.map((s) => s.col_index));
  const counts = { active: 0, maintenance: 0, disabled: 0 };
  for (const s of seats) counts[s.status]++;

  const bulk = (status: Seat["status"]) => start(async () => report(await setSeatsStatus(facilityId, ids, status)));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-serif text-lg text-ink">Generate a grid</h2>
        <p className="mb-4 text-sm text-muted">Adds rows A, B, C… with numbered seats (A01, A02…). Existing seats are kept.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Rows" htmlFor="gen-rows" className="w-28">
            <Input id="gen-rows" type="number" min={1} max={26} value={genRows} onChange={(e) => setGenRows(e.target.value)} className="h-10" />
          </Field>
          <Field label="Seats per row" htmlFor="gen-cols" className="w-32">
            <Input id="gen-cols" type="number" min={1} max={40} value={genCols} onChange={(e) => setGenCols(e.target.value)} className="h-10" />
          </Field>
          <Button
            variant="secondary"
            className="h-10"
            loading={pending}
            onClick={() => {
              const r = Number(genRows), c = Number(genCols);
              if (!Number.isInteger(r) || !Number.isInteger(c) || r < 1 || r > 26 || c < 1 || c > 40) {
                toast.error("Use 1–26 rows and 1–40 seats per row.");
                return;
              }
              start(async () => report(await generateSeats(facilityId, r, c)));
            }}
          >
            Generate
          </Button>
        </div>
      </Card>

      <section aria-labelledby="layout-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="layout-title" className="font-serif text-lg text-ink">Layout</h2>
          <p className="text-sm text-muted tabular">
            {seats.length} seats · {counts.active} active · {counts.maintenance} maintenance · {counts.disabled} disabled
          </p>
        </div>
        {seats.length === 0 ? (
          <EmptyState title="No seats yet">Generate a grid above or add seats one by one below.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface p-4">
            <div className="mx-auto w-max min-w-full space-y-2" role="group" aria-label="Seats — select to edit">
              {sortedRows.map(([row, rowSeats]) => {
                const byCol = new Map(rowSeats.map((s) => [s.col_index, s]));
                return (
                  <div key={row} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center font-serif text-sm text-muted" aria-hidden>{row}</span>
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${maxCol}, 3rem)` }}>
                      {Array.from({ length: maxCol }, (_, i) => {
                        const seat = byCol.get(i + 1);
                        if (!seat) return <span key={i} aria-hidden />;
                        const live = liveState[seat.id];
                        const isSel = selected.has(seat.id);
                        const busy = live === "reserved" || live === "occupied";
                        return (
                          <button
                            key={seat.id}
                            type="button"
                            aria-pressed={isSel}
                            aria-label={`Seat ${seat.label}, ${seat.status}${busy ? `, ${live} now` : ""}`}
                            title={`${seat.label} · ${seat.status}${busy ? ` · ${live} now` : ""}`}
                            onClick={() => toggle(seat.id)}
                            className={cn(
                              "relative grid aspect-square place-items-center rounded-[8px] border text-[11px] font-semibold tabular transition-[transform,box-shadow] duration-150 active:scale-95",
                              STATUS_STYLE[seat.status],
                              isSel && "ring-2 ring-forest ring-offset-2 ring-offset-surface",
                            )}
                          >
                            {seat.label}
                            {busy && (
                              <span aria-hidden className={cn("absolute right-1 top-1 size-1.5 rounded-full", live === "occupied" ? "bg-busy" : "bg-reserved")} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs text-ink-soft">
              <li className="flex items-center gap-1.5"><span aria-hidden className={cn("size-3.5 rounded-[4px] border", STATUS_STYLE.active)} />Active</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className={cn("size-3.5 rounded-[4px] border", STATUS_STYLE.maintenance)} />Maintenance</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className={cn("size-3.5 rounded-[4px] border", STATUS_STYLE.disabled)} />Disabled</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-reserved" />Booked now</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-busy" />Checked in now</li>
            </ul>
          </div>
        )}
      </section>

      {ids.length > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface/95 p-3 shadow-pop backdrop-blur-md">
          <span className="mr-auto text-sm font-medium text-ink tabular">{ids.length} selected</span>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => bulk("active")}>Set active</Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => bulk("maintenance")}>Maintenance</Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => bulk("disabled")}>Disable</Button>
          <DialogRoot>
            <DialogTrigger asChild><Button size="sm" variant="danger" disabled={pending}>Remove</Button></DialogTrigger>
            <DialogContent title={`Remove ${ids.length} seat${ids.length > 1 ? "s" : ""}?`} description="Seats with booking history can’t be removed — disable them instead.">
              <div className="grid grid-cols-2 gap-3">
                <DialogClose asChild><Button variant="secondary" size="lg">Cancel</Button></DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" size="lg" onClick={() => start(async () => { const r = await deleteSeats(facilityId, ids); report(r); if (!r?.error) setSelected(new Set()); })}>Remove</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </DialogRoot>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <Card className="p-5">
        <h2 className="font-serif text-lg text-ink">{single ? `Edit seat ${single.label}` : "Add a seat"}</h2>
        <p className="mb-4 text-sm text-muted">{single ? "Rename or move this seat." : "Select exactly one seat above to edit it instead."}</p>
        <SeatForm key={single?.id ?? "new"} facilityId={facilityId} seat={single} onDone={() => setSelected(new Set())} />
      </Card>
    </div>
  );
}

function SeatForm({ facilityId, seat, onDone }: { facilityId: string; seat?: Seat; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await saveSeat(prev, fd);
    if (r?.message) {
      toast.success(r.message);
      if (seat) onDone();
    }
    return r;
  }, null);
  const v = state?.values;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="facility_id" value={facilityId} />
      {seat && <input type="hidden" name="id" value={seat.id} />}
      <Field label="Label" htmlFor="seat-label">
        <Input id="seat-label" name="label" defaultValue={v?.label ?? seat?.label ?? ""} placeholder="A07" required className="h-10" />
      </Field>
      <Field label="Row" htmlFor="seat-row">
        <Input id="seat-row" name="row_label" defaultValue={v?.row_label ?? seat?.row_label ?? ""} placeholder="A" required className="h-10" />
      </Field>
      <Field label="Column" htmlFor="seat-col">
        <Input id="seat-col" name="col_index" type="number" min={1} max={200} defaultValue={v?.col_index ?? seat?.col_index ?? ""} required className="h-10" />
      </Field>
      <Field label="Status" htmlFor="seat-status">
        <Select id="seat-status" name="status" defaultValue={v?.status ?? seat?.status ?? "active"} className="h-10">
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="disabled">Disabled</option>
        </Select>
      </Field>
      <Button type="submit" className="h-10" loading={pending}>{seat ? "Save" : "Add seat"}</Button>
      {state?.error && <p role="alert" className="text-sm text-busy sm:col-span-5">{state.error}</p>}
    </form>
  );
}
