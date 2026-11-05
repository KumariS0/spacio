import { Armchair, CalendarDays, CircleX, Clock, Hash, LogIn, LogOut, MapPin } from "lucide-react";
import { durationLabel, formatDateTime, formatLongDay, formatRange, minutesBetween } from "@/lib/time";
import type { Reservation } from "@/lib/types";

export function ReservationDetails({ reservation: r }: { reservation: Reservation }) {
  const f = r.facility;
  const rows = [
    { icon: CalendarDays, label: "Date", value: formatLongDay(r.starts_at) },
    { icon: Clock, label: "Time", value: `${formatRange(r.starts_at, r.ends_at)} · ${durationLabel(minutesBetween(r.starts_at, r.ends_at))}` },
    r.seat?.label ? { icon: Armchair, label: "Seat", value: r.seat.label } : null,
    { icon: MapPin, label: "Location", value: [f?.building?.name, f?.floor_label].filter(Boolean).join(" · ") || "—" },
    r.checked_in_at ? { icon: LogIn, label: "Checked in", value: formatDateTime(r.checked_in_at) } : null,
    r.checked_out_at ? { icon: LogOut, label: r.status === "EXPIRED" ? "Ended (no check-out)" : "Checked out", value: formatDateTime(r.checked_out_at) } : null,
    r.cancelled_at
      ? { icon: CircleX, label: "Cancelled", value: `${formatDateTime(r.cancelled_at)}${r.cancelled_by && r.cancelled_by !== r.user_id ? " by staff" : ""}${r.cancel_reason ? ` — ${r.cancel_reason}` : ""}` }
      : null,
    { icon: Hash, label: "Reservation ID", value: r.id.slice(0, 8).toUpperCase(), mono: true },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string; mono?: boolean }[];

  return (
    <dl className="divide-y divide-line rounded-card border border-line bg-surface">
      {rows.map(({ icon: Icon, label, value, mono }) => (
        <div key={label} className="flex items-center gap-3 px-4 py-3">
          <Icon className="size-4.5 shrink-0 text-muted" aria-hidden />
          <dt className="w-32 shrink-0 text-sm text-muted">{label}</dt>
          <dd className={mono ? "font-mono text-sm tracking-wider text-ink" : "tabular text-sm text-ink"}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
