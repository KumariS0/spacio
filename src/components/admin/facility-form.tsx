"use client";

import { useActionState, useState } from "react";
import { saveFacility } from "@/actions/admin";
import type { FormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import type { Building, Category, Facility, OperatingHours } from "@/lib/types";
import { WEEKDAYS } from "@/lib/time";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 border-t border-line pt-6 first:border-t-0 first:pt-0 lg:grid-cols-[220px_minmax(0,1fr)]">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="font-serif text-lg text-ink" aria-hidden>{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function FacilityForm({
  facility,
  categories,
  buildings,
  hours,
}: {
  facility?: Facility;
  categories: Category[];
  buildings: Building[];
  hours?: OperatingHours[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveFacility, null);
  const v = state?.values;
  const fe = state?.fieldErrors ?? {};
  const val = (k: keyof Facility, fallback = "") => v?.[k as string] ?? (facility?.[k] != null ? String(facility[k]) : fallback);
  const [mode, setMode] = useState(val("booking_mode", "seat"));
  const hourFor = (d: number) => hours?.find((h) => h.weekday === d);

  return (
    <form action={action} className="space-y-8" noValidate encType="multipart/form-data">
      {facility && <input type="hidden" name="id" value={facility.id} />}

      <Section title="Basics" description="What students see on cards and the details page.">
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={val("name")} required invalid={Boolean(fe.name)} />
        </Field>
        <Field label="URL name" htmlFor="slug" optional error={fe.slug} hint="Generated from the name if left empty.">
          <Input id="slug" name="slug" defaultValue={val("slug")} placeholder="central-library" />
        </Field>
        <Field label="Category" htmlFor="category" error={fe.category}>
          <Select id="category" name="category" defaultValue={val("category", categories[0]?.slug)}>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Short tagline" htmlFor="tagline" optional error={fe.tagline}>
          <Input id="tagline" name="tagline" defaultValue={val("tagline")} maxLength={140} />
        </Field>
        <Field label="Description" htmlFor="description" optional className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={val("description")} rows={4} maxLength={4000} />
        </Field>
        <Field label="Rules (one per line)" htmlFor="rules" optional className="sm:col-span-2">
          <Textarea id="rules" name="rules" defaultValue={v?.rules ?? facility?.rules.join("\n") ?? ""} rows={3} />
        </Field>
      </Section>

      <Section title="Image" description="JPEG, PNG or WebP, up to 5 MB. Stored in Supabase Storage.">
        <Field label="Upload image" htmlFor="image_file" optional error={fe.image_file}>
          <input id="image_file" name="image_file" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-ink-soft file:mr-3 file:h-10 file:rounded-[9px] file:border-0 file:bg-forest-tint file:px-3 file:text-sm file:font-medium file:text-forest-deep hover:file:bg-[#d2dfcd]" />
        </Field>
        <Field label="…or image URL" htmlFor="image_url" optional error={fe.image_url}>
          <Input id="image_url" name="image_url" defaultValue={val("image_url")} placeholder="https://… or /images/…" />
        </Field>
      </Section>

      <Section title="Location" description="Building and floor are shown to students. Map positions are percentages on the schematic map.">
        <Field label="Building" htmlFor="building_id" optional>
          <Select id="building_id" name="building_id" defaultValue={val("building_id")}>
            <option value="">No building</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Floor" htmlFor="floor_label" optional>
          <Input id="floor_label" name="floor_label" defaultValue={val("floor_label")} placeholder="Ground floor" />
        </Field>
        <Field label="Schematic X (0–100)" htmlFor="map_x" optional error={fe.map_x} hint="Leave empty to use the building's position.">
          <Input id="map_x" name="map_x" type="number" min={0} max={100} step="0.1" defaultValue={val("map_x")} />
        </Field>
        <Field label="Schematic Y (0–100)" htmlFor="map_y" optional error={fe.map_y}>
          <Input id="map_y" name="map_y" type="number" min={0} max={100} step="0.1" defaultValue={val("map_y")} />
        </Field>
        <Field label="Latitude (verified only)" htmlFor="lat" optional error={fe.lat} hint="Only enter coordinates you have verified.">
          <Input id="lat" name="lat" type="number" step="any" defaultValue={val("lat")} />
        </Field>
        <Field label="Longitude (verified only)" htmlFor="lng" optional error={fe.lng}>
          <Input id="lng" name="lng" type="number" step="any" defaultValue={val("lng")} />
        </Field>
      </Section>

      <Section title="Booking" description="How students reserve this space.">
        <Field label="Reservation type" htmlFor="booking_mode">
          <Select id="booking_mode" name="booking_mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="seat">Seat-based (individual seats)</option>
            <option value="capacity">Capacity-based (places)</option>
            <option value="none">Location only (not bookable)</option>
          </Select>
        </Field>
        {mode === "capacity" && (
          <Field label="Capacity" htmlFor="capacity" error={fe.capacity}>
            <Input id="capacity" name="capacity" type="number" min={1} max={10000} defaultValue={val("capacity")} invalid={Boolean(fe.capacity)} />
          </Field>
        )}
        {mode === "seat" && !facility && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seat rows" htmlFor="seat_rows" optional hint="A, B, C…">
              <Input id="seat_rows" name="seat_rows" type="number" min={0} max={26} defaultValue="3" />
            </Field>
            <Field label="Seats per row" htmlFor="seat_cols" optional>
              <Input id="seat_cols" name="seat_cols" type="number" min={0} max={40} defaultValue="4" />
            </Field>
          </div>
        )}
        {mode === "seat" && facility && <p className="self-end text-sm text-muted">Manage seats from the Seats page.</p>}
        {mode !== "none" && (
          <>
            <Field label="Slot length" htmlFor="slot_minutes">
              <Select id="slot_minutes" name="slot_minutes" defaultValue={val("slot_minutes", "60")}>
                {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </Select>
            </Field>
            <Field label="Longest booking (minutes)" htmlFor="max_booking_minutes" error={fe.max_booking_minutes}>
              <Input id="max_booking_minutes" name="max_booking_minutes" type="number" min={15} max={720} step={15} defaultValue={val("max_booking_minutes", "180")} />
            </Field>
            <Field label="No-show grace (minutes)" htmlFor="no_show_grace_minutes" hint="Released if not checked in by then.">
              <Input id="no_show_grace_minutes" name="no_show_grace_minutes" type="number" min={5} max={120} defaultValue={val("no_show_grace_minutes", "15")} />
            </Field>
            <Field label="Early check-in (minutes)" htmlFor="checkin_early_minutes">
              <Input id="checkin_early_minutes" name="checkin_early_minutes" type="number" min={0} max={120} defaultValue={val("checkin_early_minutes", "15")} />
            </Field>
          </>
        )}
        {mode === "none" && (
          <>
            <input type="hidden" name="slot_minutes" value="60" />
            <input type="hidden" name="max_booking_minutes" value="180" />
            <input type="hidden" name="no_show_grace_minutes" value="15" />
            <input type="hidden" name="checkin_early_minutes" value="15" />
          </>
        )}
      </Section>

      <Section title="Opening hours" description="Bookings must fit inside these hours. Set closing to 00:00 for midnight.">
        <div className="space-y-2 sm:col-span-2">
          {fe.hours && <p role="alert" className="text-sm text-busy">{fe.hours}</p>}
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const h = hourFor(d);
            const close = h?.closes_at?.slice(0, 5);
            return (
              <div key={d} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-2 sm:grid-cols-[140px_160px_160px_auto]">
                <span className="text-sm text-ink">{WEEKDAYS[d]}</span>
                <label className="sr-only" htmlFor={`hours_${d}_open`}>{WEEKDAYS[d]} opens</label>
                <Input id={`hours_${d}_open`} name={`hours_${d}_open`} type="time" defaultValue={h?.opens_at?.slice(0, 5) ?? "08:00"} className="h-10" />
                <label className="sr-only" htmlFor={`hours_${d}_close`}>{WEEKDAYS[d]} closes</label>
                <Input id={`hours_${d}_close`} name={`hours_${d}_close`} type="time" defaultValue={close === "24:00" ? "00:00" : close ?? "22:00"} className="h-10" />
                <Checkbox name={`hours_${d}_closed`} label="Closed" defaultChecked={h?.is_closed ?? false} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Status">
        <Checkbox name="is_active" label="Active (visible to students)" defaultChecked={v ? v.is_active === "true" : facility?.is_active ?? true} />
        <Checkbox name="is_temporarily_closed" label="Temporarily closed (no new bookings)" defaultChecked={v ? v.is_temporarily_closed === "true" : facility?.is_temporarily_closed ?? false} />
        <Field label="Closure note" htmlFor="closure_note" optional className="sm:col-span-2">
          <Input id="closure_note" name="closure_note" defaultValue={val("closure_note")} placeholder="e.g. Closed for maintenance until Monday" />
        </Field>
        <Checkbox name="is_demo" label="Mark as demonstration data (shows a disclaimer)" defaultChecked={v ? v.is_demo === "true" : facility?.is_demo ?? false} />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        <Button type="submit" size="lg" loading={pending}>{facility ? "Save changes" : "Create facility"}</Button>
        {state?.error && <Alert tone="error" className="flex-1 py-2">{state.error}</Alert>}
        {state?.message && <Alert tone="success" className="flex-1 py-2">{state.message}</Alert>}
      </div>
    </form>
  );
}
