import { publicEnv } from "./env";

const TZ = publicEnv.campusTz;
const NNBSP = " ";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts });

const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = fmt({ weekday: "short", day: "numeric", month: "short" });
const longDayFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false });

export function formatTime(d: string | Date) {
  return timeFmt.format(new Date(d)).replace(/\s/g, NNBSP).toLowerCase();
}

export function formatDay(d: string | Date) {
  return dayFmt.format(new Date(d));
}

export function formatLongDay(d: string | Date) {
  return longDayFmt.format(new Date(d));
}

export function formatRange(start: string | Date, end: string | Date) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDateTime(d: string | Date) {
  return `${formatDay(d)}, ${formatTime(d)}`;
}

/** "HH:MM:SS" time-of-day string (from Postgres `time`) → "8 am" / "8:30 am". */
export function formatClock(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (h === 24 || (h === 0 && m === 0 && t.startsWith("24"))) return "midnight";
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? "am" : "pm";
  return m ? `${hour12}:${String(m).padStart(2, "0")}${NNBSP}${suffix}` : `${hour12}${NNBSP}${suffix}`;
}

/** Campus-local calendar date "YYYY-MM-DD". */
export function campusDate(d: Date = new Date()) {
  return isoDateFmt.format(d);
}

/** The next `n` campus-local dates starting today. */
export function upcomingDates(n: number, from: Date = new Date()) {
  const out: { iso: string; label: string; isToday: boolean }[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < n && i < n + 2; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    const iso = campusDate(d);
    if (seen.has(iso)) continue;
    seen.add(iso);
    const idx = out.length;
    out.push({ iso, label: idx === 0 ? "Today" : idx === 1 ? "Tomorrow" : formatDay(d), isToday: idx === 0 });
  }
  return out;
}

export function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${m} min`;
}

export function minutesBetween(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}

export function greeting(d: Date = new Date()) {
  const h = Number(hourFmt.format(d));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day of week (0 = Sunday) on campus, regardless of server timezone. */
export function campusWeekday(d: Date = new Date()) {
  return WD.indexOf(weekdayFmt.format(d));
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
