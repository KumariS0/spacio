/** Public (browser-safe) configuration. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  campusName: process.env.NEXT_PUBLIC_CAMPUS_NAME ?? "SRM Institute of Science and Technology, Kattankulathur",
  campusShortName: process.env.NEXT_PUBLIC_CAMPUS_SHORT_NAME ?? "SRM KTR",
  campusTz: process.env.NEXT_PUBLIC_CAMPUS_TZ ?? "Asia/Kolkata",
  otpLength: Number(process.env.NEXT_PUBLIC_OTP_LENGTH ?? 6) || 6,
  mapCenter:
    process.env.NEXT_PUBLIC_MAP_CENTER_LAT && process.env.NEXT_PUBLIC_MAP_CENTER_LNG
      ? {
          lat: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT),
          lng: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG),
          zoom: Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 17) || 17,
        }
      : null,
};

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/** Domains allowed to sign in (server-side source; the DB enforces its own list too). */
export function allowedEmailDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "srmist.edu.in")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
