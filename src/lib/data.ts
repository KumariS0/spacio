import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allowedEmailDomains, isSupabaseConfigured } from "@/lib/env";
import { isAllowedEmail } from "@/lib/auth/domains";
import type {
  Amenity,
  Availability,
  Building,
  CampusStats,
  Category,
  Facility,
  OperatingHours,
  Profile,
  Reservation,
} from "@/lib/types";

export const FACILITY_SELECT = "*, building:buildings(id, name, code, map_x, map_y, lat, lng)";
export const RESERVATION_SELECT =
  "*, facility:facilities(id, slug, name, image_url, category, floor_label, booking_mode, checkin_early_minutes, no_show_grace_minutes, building:buildings(name)), seat:facility_seats(label)";

export const getSupabase = cache(async () => createClient());

/** Signed-in user (validated with the Auth server) and their profile. */
export const getViewer = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle<Profile>();
  return {
    user: data.user,
    profile,
    isAdmin: profile?.role === "admin",
    emailVerified: Boolean(data.user.email_confirmed_at),
    domainAllowed: isAllowedEmail(data.user.email ?? "", allowedEmailDomains()),
  };
});

/**
 * Guard for student pages. Redirects signed-out users to login, signs out
 * accounts outside the allowed domains, and sends first-time users to
 * onboarding. The database applies the same rules independently.
 */
export async function requireStudent(opts: { allowIncompleteProfile?: boolean } = {}) {
  // Always render per request, even when built without Supabase keys, so a
  // signed-out redirect is never baked into a static page.
  await connection();
  if (!isSupabaseConfigured()) redirect("/login?error=not_configured");
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.emailVerified || (!viewer.domainAllowed && !viewer.isAdmin)) {
    redirect("/auth/signout?reason=domain");
  }
  if (!viewer.profile) redirect("/auth/signout?reason=profile");
  if (!viewer.profile.full_name && !opts.allowIncompleteProfile) redirect("/onboarding");
  return { ...viewer, profile: viewer.profile };
}

/** Guard for every admin page. Non-admins are sent to /forbidden. */
export async function requireAdmin() {
  const viewer = await requireStudent();
  if (!viewer.isAdmin) redirect("/forbidden");
  return viewer;
}

export const getCategories = cache(async () => {
  const supabase = await getSupabase();
  const { data } = await supabase.from("facility_categories").select("*").order("sort_order");
  return (data ?? []) as Category[];
});

export const getFacilities = cache(async () => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("facilities").select(FACILITY_SELECT).eq("is_active", true).order("name");
  if (error) throw new Error("Could not load facilities.");
  return (data ?? []) as Facility[];
});

export const getFacilityBySlug = cache(async (slug: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase.from("facilities").select(FACILITY_SELECT).eq("slug", slug).maybeSingle();
  return (data as Facility | null) ?? null;
});

export async function getFacilityDetails(facilityId: string) {
  const supabase = await getSupabase();
  const [hours, amenities] = await Promise.all([
    supabase.from("facility_operating_hours").select("*").eq("facility_id", facilityId).order("weekday"),
    supabase.from("facility_amenities").select("*").eq("facility_id", facilityId).order("sort_order"),
  ]);
  return {
    hours: (hours.data ?? []) as OperatingHours[],
    amenities: (amenities.data ?? []) as Amenity[],
  };
}

export const getAvailability = cache(async (ids?: string[]) => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("get_facility_availability", { p_facility_ids: ids ?? null });
  if (error) throw new Error("Could not load availability.");
  return (data ?? []) as Availability[];
});

export const getCampusStats = cache(async () => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("get_campus_stats");
  if (error) throw new Error("Could not load campus statistics.");
  return data as CampusStats;
});

export const getFavoriteIds = cache(async () => {
  const supabase = await getSupabase();
  const { data } = await supabase.from("favorites").select("facility_id, created_at").order("created_at", { ascending: false });
  return (data ?? []).map((f) => f.facility_id as string);
});

export async function getMyReservations(opts: { limit?: number } = {}) {
  const viewer = await getViewer();
  if (!viewer) return [];
  const supabase = await getSupabase();
  // Opportunistically settle expired/no-show states so lists are accurate.
  await supabase.rpc("sweep_reservations");
  // Filter by owner explicitly: RLS lets admins read every reservation, but
  // "my bookings" (and Nook's context) must only ever contain the caller's own.
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("user_id", viewer.user.id)
    .order("starts_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (error) throw new Error("Could not load your bookings.");
  return (data ?? []) as Reservation[];
}

export async function getMyReservation(id: string) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await getSupabase();
  await supabase.rpc("sweep_reservations");
  const { data } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("id", id)
    .eq("user_id", viewer.user.id)
    .maybeSingle();
  return (data as Reservation | null) ?? null;
}

export async function getBuildings() {
  const supabase = await getSupabase();
  const { data } = await supabase.from("buildings").select("*").order("name");
  return (data ?? []) as Building[];
}

export function availabilityMap(rows: Availability[]) {
  return Object.fromEntries(rows.map((r) => [r.facility_id, r])) as Record<string, Availability>;
}
