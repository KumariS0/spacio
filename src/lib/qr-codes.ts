import "server-only";
import QRCode from "qrcode";
import { getSupabase } from "@/lib/data";
import { publicEnv } from "@/lib/env";
import { buildPassPayload, buildQrPayload } from "@/lib/qr";

export interface FacilityQr {
  facilityId: string;
  name: string;
  slug: string;
  location: string;
  isActive: boolean;
  token: string | null;
  createdAt: string | null;
  payload: string | null;
  svg: string | null;
  png: string | null;
}

/** Loads every facility with its active QR token and renders the codes server-side. Admin only (RLS). */
export async function getFacilityQrCodes(): Promise<FacilityQr[]> {
  const supabase = await getSupabase();
  const [{ data: facilities }, { data: codes }] = await Promise.all([
    supabase.from("facilities").select("id, name, slug, is_active, floor_label, building:buildings(name)").order("name"),
    supabase.from("facility_qr_codes").select("facility_id, token, created_at").eq("is_active", true),
  ]);
  const byFacility = new Map((codes ?? []).map((c) => [c.facility_id as string, c]));
  const site = publicEnv.siteUrl;

  return Promise.all(
    (facilities ?? []).map(async (f) => {
      const code = byFacility.get(f.id);
      const payload = code ? buildQrPayload(site, code.token) : null;
      const building = (Array.isArray(f.building) ? f.building[0] : f.building) as { name: string } | null;
      const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#1c2a23", light: "#ffffff" } };
      return {
        facilityId: f.id,
        name: f.name,
        slug: f.slug,
        location: [building?.name, f.floor_label].filter(Boolean).join(" · "),
        isActive: f.is_active,
        token: code?.token ?? null,
        createdAt: code?.created_at ?? null,
        payload,
        svg: payload ? await QRCode.toString(payload, { ...opts, type: "svg" }) : null,
        png: payload ? await QRCode.toDataURL(payload, { ...opts, width: 1024 }) : null,
      };
    }),
  );
}

/** Renders a booking's QR pass as inline SVG (server-side, so the token never needs client JS). */
export async function bookingPassSvg(token: string) {
  const payload = buildPassPayload(publicEnv.siteUrl, token);
  const svg = await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#14261d", light: "#ffffff" } });
  return { payload, svg };
}
