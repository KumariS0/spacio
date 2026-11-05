"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { codeFrom, messageFor } from "@/lib/errors";
import type { FormState } from "@/actions/auth";
import type { PassLookup } from "@/lib/types";

/**
 * Every admin action re-checks the role on the server via public.is_admin().
 * RLS policies enforce the same rule again in the database, so a forged
 * request from a student is rejected twice.
 */
async function adminClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) throw new Error("FORBIDDEN");
  return supabase;
}

function fail(error: unknown, fallback = "Something went wrong. Please try again."): FormState {
  const msg = (error as { message?: string })?.message ?? "";
  if (msg === "FORBIDDEN") return { error: messageFor("FORBIDDEN") };
  if (/duplicate key|unique/i.test(msg)) return { error: "That name or identifier is already in use." };
  if (/foreign key|violates.*reservations/i.test(msg)) return { error: "This item still has reservations linked to it. Deactivate it instead." };
  if (/check constraint/i.test(msg)) return { error: "Some values are out of range. Check the form and try again." };
  return { error: messageFor(codeFrom(error as { message?: string }), fallback) };
}

const num = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(min).max(max).nullable());

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

const facilitySchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
    slug: z.string().trim().max(60).optional(),
    tagline: z.string().trim().max(140).optional(),
    description: z.string().trim().max(4000).optional(),
    category: z.string().min(1, "Choose a category."),
    building_id: z.string().optional(),
    floor_label: z.string().trim().max(40).optional(),
    image_url: z.string().trim().max(500).optional(),
    booking_mode: z.enum(["seat", "capacity", "none"]),
    capacity: num(1, 10000),
    slot_minutes: z.coerce.number().refine((v) => [15, 30, 45, 60, 90, 120].includes(v), "Pick a slot length."),
    max_booking_minutes: z.coerce.number().min(15).max(720),
    no_show_grace_minutes: z.coerce.number().min(5).max(120),
    checkin_early_minutes: z.coerce.number().min(0).max(120),
    rules: z.string().max(4000).optional(),
    is_active: z.boolean(),
    is_temporarily_closed: z.boolean(),
    closure_note: z.string().trim().max(200).optional(),
    map_x: num(0, 100),
    map_y: num(0, 100),
    lat: num(-90, 90),
    lng: num(-180, 180),
    is_demo: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.booking_mode === "capacity" && !v.capacity) ctx.addIssue({ code: "custom", path: ["capacity"], message: "Capacity-based spaces need a capacity." });
    if (v.max_booking_minutes < v.slot_minutes) ctx.addIssue({ code: "custom", path: ["max_booking_minutes"], message: "Must be at least one slot long." });
    if ((v.lat == null) !== (v.lng == null)) ctx.addIssue({ code: "custom", path: ["lat"], message: "Enter both latitude and longitude, or neither." });
    if (v.image_url && !/^(https:\/\/|\/)/.test(v.image_url)) ctx.addIssue({ code: "custom", path: ["image_url"], message: "Use an https:// URL or upload an image." });
  });

function readFacilityForm(fd: FormData) {
  const s = (k: string) => (fd.get(k) == null ? undefined : String(fd.get(k)));
  return {
    name: s("name") ?? "",
    slug: s("slug"),
    tagline: s("tagline"),
    description: s("description"),
    category: s("category") ?? "",
    building_id: s("building_id"),
    floor_label: s("floor_label"),
    image_url: s("image_url"),
    booking_mode: s("booking_mode") ?? "none",
    capacity: s("capacity"),
    slot_minutes: s("slot_minutes") ?? "60",
    max_booking_minutes: s("max_booking_minutes") ?? "180",
    no_show_grace_minutes: s("no_show_grace_minutes") ?? "15",
    checkin_early_minutes: s("checkin_early_minutes") ?? "15",
    rules: s("rules"),
    is_active: fd.get("is_active") === "on",
    is_temporarily_closed: fd.get("is_temporarily_closed") === "on",
    closure_note: s("closure_note"),
    map_x: s("map_x"),
    map_y: s("map_y"),
    lat: s("lat"),
    lng: s("lng"),
    is_demo: fd.get("is_demo") === "on",
  };
}

async function uploadImage(supabase: Awaited<ReturnType<typeof createClient>>, file: File, slug: string) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Images must be JPEG, PNG or WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${slug}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("facility-images").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Image upload failed. Check the storage bucket is set up (see docs).");
  return supabase.storage.from("facility-images").getPublicUrl(path).data.publicUrl;
}

export async function saveFacility(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = readFacilityForm(fd);
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v ?? "")]));
  const parsed = facilitySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values, error: "Please fix the highlighted fields." };
  }
  const v = parsed.data;
  const id = String(fd.get("id") ?? "") || null;
  const slug = slugify(v.slug || v.name);
  if (!slug) return { fieldErrors: { slug: "Enter a URL name using letters or numbers." }, values };

  let supabase;
  try {
    supabase = await adminClient();
  } catch (e) {
    return fail(e);
  }

  let image_url = v.image_url || null;
  const file = fd.get("image_file");
  if (file instanceof File && file.size > 0) {
    try {
      image_url = await uploadImage(supabase, file, slug);
    } catch (e) {
      return { fieldErrors: { image_file: (e as Error).message }, values };
    }
  }

  const row = {
    slug,
    name: v.name,
    tagline: v.tagline || null,
    description: v.description || null,
    category: v.category,
    building_id: v.building_id || null,
    floor_label: v.floor_label || null,
    image_url,
    booking_mode: v.booking_mode,
    capacity: v.booking_mode === "capacity" ? v.capacity : null,
    slot_minutes: v.slot_minutes,
    max_booking_minutes: v.max_booking_minutes,
    no_show_grace_minutes: v.no_show_grace_minutes,
    checkin_early_minutes: v.checkin_early_minutes,
    rules: (v.rules ?? "").split("\n").map((r) => r.trim()).filter(Boolean).slice(0, 20),
    is_active: v.is_active,
    is_temporarily_closed: v.is_temporarily_closed,
    closure_note: v.closure_note || null,
    map_x: v.map_x,
    map_y: v.map_y,
    lat: v.lat,
    lng: v.lng,
    is_demo: v.is_demo,
  };

  let facilityId = id;
  if (id) {
    const { error } = await supabase.from("facilities").update(row).eq("id", id);
    if (error) return { ...fail(error), values };
  } else {
    const { data, error } = await supabase.from("facilities").insert(row).select("id").single();
    if (error) return { ...fail(error), values };
    facilityId = data.id as string;
    await supabase.rpc("admin_rotate_qr", { p_facility_id: facilityId });
  }

  // Opening hours: 7 rows.
  const hours = Array.from({ length: 7 }, (_, d) => ({
    facility_id: facilityId!,
    weekday: d,
    is_closed: fd.get(`hours_${d}_closed`) === "on",
    opens_at: String(fd.get(`hours_${d}_open`) || "08:00"),
    closes_at: String(fd.get(`hours_${d}_close`) || "20:00"),
  }));
  const badDay = hours.find((h) => !h.is_closed && h.opens_at >= h.closes_at && h.closes_at !== "00:00");
  if (badDay) return { fieldErrors: { hours: "Closing time must be after opening time." }, values, error: "Check the opening hours." };
  const fixed = hours.map((h) => ({ ...h, closes_at: h.closes_at === "00:00" ? "24:00" : h.closes_at }));
  const { error: hErr } = await supabase.from("facility_operating_hours").upsert(fixed, { onConflict: "facility_id,weekday" });
  if (hErr) return { ...fail(hErr), values };

  if (!id && v.booking_mode === "seat") {
    const rows = Number(fd.get("seat_rows") || 0);
    const cols = Number(fd.get("seat_cols") || 0);
    if (rows > 0 && cols > 0) await supabase.rpc("admin_generate_seats", { p_facility_id: facilityId, p_rows: rows, p_cols: cols });
  }

  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/facilities/${facilityId}?created=1`);
  return { message: "Saved." };
}

export async function deleteFacility(facilityId: string): Promise<FormState> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("facilities").delete().eq("id", facilityId);
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect("/admin/facilities");
}

export async function setFacilityActive(facilityId: string, active: boolean): Promise<FormState> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("facilities").update({ is_active: active }).eq("id", facilityId);
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { message: active ? "Facility activated." : "Facility deactivated." };
}

// ─── Amenities ───────────────────────────────────────────────────────────────
export async function addAmenity(_prev: FormState, fd: FormData): Promise<FormState> {
  const label = String(fd.get("label") ?? "").trim();
  const icon = String(fd.get("icon") ?? "check");
  const facility_id = String(fd.get("facility_id") ?? "");
  if (label.length < 1 || label.length > 60) return { fieldErrors: { label: "Enter a short label (1–60 characters)." } };
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("facility_amenities").insert({ facility_id, label, icon, sort_order: Date.now() % 100000 });
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/admin/facilities/${facility_id}`);
  return { message: "Added." };
}

export async function removeAmenity(id: string, facilityId: string): Promise<FormState> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("facility_amenities").delete().eq("id", id);
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/admin/facilities/${facilityId}`);
  return { message: "Removed." };
}

// ─── Seats ───────────────────────────────────────────────────────────────────
export async function generateSeats(facilityId: string, rows: number, cols: number): Promise<FormState> {
  try {
    const supabase = await adminClient();
    const { data, error } = await supabase.rpc("admin_generate_seats", { p_facility_id: facilityId, p_rows: rows, p_cols: cols });
    if (error) return fail(error);
    revalidatePath(`/admin/facilities/${facilityId}/seats`);
    return { message: `${data ?? 0} seats added.` };
  } catch (e) {
    return fail(e);
  }
}

const seatSchema = z.object({
  label: z.string().trim().regex(/^[A-Za-z0-9-]{1,10}$/, "Labels are 1–10 letters, digits or dashes."),
  row_label: z.string().trim().regex(/^[A-Za-z0-9]{1,4}$/, "Rows are 1–4 letters or digits."),
  col_index: z.coerce.number().int().min(1).max(200),
  status: z.enum(["active", "maintenance", "disabled"]),
});

export async function saveSeat(_prev: FormState, fd: FormData): Promise<FormState> {
  const facilityId = String(fd.get("facility_id") ?? "");
  const id = String(fd.get("id") ?? "") || null;
  const values = { label: String(fd.get("label") ?? ""), row_label: String(fd.get("row_label") ?? ""), col_index: String(fd.get("col_index") ?? ""), status: String(fd.get("status") ?? "active") };
  const parsed = seatSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  try {
    const supabase = await adminClient();
    const { error } = id
      ? await supabase.from("facility_seats").update(parsed.data).eq("id", id)
      : await supabase.from("facility_seats").insert({ ...parsed.data, facility_id: facilityId });
    if (error) return { ...fail(error), values };
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/admin/facilities/${facilityId}/seats`);
  return { message: id ? "Seat updated." : "Seat added." };
}

export async function setSeatsStatus(facilityId: string, seatIds: string[], status: "active" | "maintenance" | "disabled"): Promise<FormState> {
  if (!seatIds.length) return { error: "Select at least one seat." };
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("facility_seats").update({ status }).in("id", seatIds).eq("facility_id", facilityId);
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/admin/facilities/${facilityId}/seats`);
  return { message: `${seatIds.length} seat${seatIds.length > 1 ? "s" : ""} set to ${status}.` };
}

export async function deleteSeats(facilityId: string, seatIds: string[]): Promise<FormState> {
  if (!seatIds.length) return { error: "Select at least one seat." };
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("facility_seats").delete().in("id", seatIds).eq("facility_id", facilityId);
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/admin/facilities/${facilityId}/seats`);
  return { message: "Seats removed." };
}

// ─── Buildings ───────────────────────────────────────────────────────────────
const buildingSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().max(20).optional(),
    description: z.string().trim().max(1000).optional(),
    map_x: num(0, 100),
    map_y: num(0, 100),
    lat: num(-90, 90),
    lng: num(-180, 180),
    is_demo: z.boolean(),
  })
  .refine((v) => (v.lat == null) === (v.lng == null), { path: ["lat"], message: "Enter both latitude and longitude, or neither." });

export async function saveBuilding(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id") ?? "") || null;
  const raw = {
    name: String(fd.get("name") ?? ""),
    code: String(fd.get("code") ?? ""),
    description: String(fd.get("description") ?? ""),
    map_x: String(fd.get("map_x") ?? ""),
    map_y: String(fd.get("map_y") ?? ""),
    lat: String(fd.get("lat") ?? ""),
    lng: String(fd.get("lng") ?? ""),
    is_demo: fd.get("is_demo") === "on",
  };
  const parsed = buildingSchema.safeParse(raw);
  const values = { ...raw, is_demo: raw.is_demo ? "on" : "" };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const row = { ...parsed.data, code: parsed.data.code || null, description: parsed.data.description || null };
  try {
    const supabase = await adminClient();
    const { error } = id ? await supabase.from("buildings").update(row).eq("id", id) : await supabase.from("buildings").insert(row);
    if (error) return { ...fail(error), values };
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { message: id ? "Building updated." : "Building added." };
}

export async function deleteBuilding(id: string): Promise<FormState> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("buildings").delete().eq("id", id);
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { message: "Building removed. Facilities in it now have no building." };
}

// ─── Reservations & QR ───────────────────────────────────────────────────────
export async function adminCancelReservation(id: string, reason: string): Promise<FormState> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.rpc("admin_cancel_reservation", { p_reservation_id: id, p_reason: reason.slice(0, 200) || null });
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/reservations");
  return { message: "Reservation cancelled." };
}

export async function rotateQr(facilityId: string): Promise<FormState> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.rpc("admin_rotate_qr", { p_facility_id: facilityId });
    if (error) return fail(error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/qr");
  return { message: "New QR code generated. Print it and replace the old one — the old code no longer works." };
}

export async function sweepNow(): Promise<FormState> {
  try {
    const supabase = await adminClient();
    const { data, error } = await supabase.rpc("sweep_reservations");
    if (error) return fail(error);
    revalidatePath("/admin", "layout");
    return { message: `${data ?? 0} reservation${data === 1 ? "" : "s"} updated (no-shows / expired).` };
  } catch (e) {
    return fail(e);
  }
}

// ─── Booking passes (admin scans a student's pass) ─────────────────────────

const passFail = (e: unknown) => ({ error: fail(e)?.error ?? "Something went wrong. Please try again." });

const passToken = z.string().trim().regex(/^[A-Za-z0-9_-]{16,64}$/);

/** Look a pass up without changing it. */
export async function lookupPass(token: string): Promise<{ data?: PassLookup; error?: string }> {
  const t = passToken.safeParse(token);
  if (!t.success) return { data: { result: "INVALID_PASS" } };
  try {
    const supabase = await adminClient();
    const { data, error } = await supabase.rpc("staff_lookup_pass", { p_token: t.data });
    if (error) return passFail(error);
    return { data: data as PassLookup };
  } catch (e) {
    return passFail(e);
  }
}

/** Check the pass holder in or out. The database validates the window and state. */
export async function passAction(token: string, action: "check_in" | "check_out"): Promise<{ data?: PassLookup; error?: string }> {
  const t = passToken.safeParse(token);
  if (!t.success) return { data: { result: "INVALID_PASS" } };
  if (action !== "check_in" && action !== "check_out") return { error: "Unknown action." };
  try {
    const supabase = await adminClient();
    const { data, error } = await supabase.rpc("staff_pass_action", { p_token: t.data, p_action: action });
    if (error) return passFail(error);
    revalidatePath("/admin");
    return { data: data as PassLookup };
  } catch (e) {
    return passFail(e);
  }
}
