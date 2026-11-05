import Link from "next/link";
import { ArrowUpRight, Armchair, CalendarDays, Clock, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { FacilityImage } from "@/components/spaces/space-card";
import { durationLabel, formatDay, formatRange, formatTime, minutesBetween } from "@/lib/time";
import type { Reservation } from "@/lib/types";
import { cn } from "@/lib/cn";

export function BookingCard({ reservation: r, className }: { reservation: Reservation; className?: string }) {
  const f = r.facility;
  return (
    <article className={cn("@container group relative flex gap-3.5 rounded-card border border-line bg-surface p-3 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop", className)}>
      {f && <FacilityImage facility={f} className="hidden w-24 shrink-0 self-stretch rounded-[10px] @[380px]:block" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-serif text-lg leading-tight text-ink">
            <Link href={`/bookings/${r.id}`} className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-forest">
              {f?.name ?? "Facility"}
            </Link>
          </h3>
          <StatusBadge status={r.status} className="shrink-0" />
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] text-ink-soft @[520px]:grid-cols-2">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Date</dt>
            <CalendarDays className="size-3.5 shrink-0 text-muted" aria-hidden />
            <dd>{formatDay(r.starts_at)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Time</dt>
            <Clock className="size-3.5 shrink-0 text-muted" aria-hidden />
            <dd className="tabular whitespace-nowrap">
              {formatRange(r.starts_at, r.ends_at)} · {durationLabel(minutesBetween(r.starts_at, r.ends_at))}
            </dd>
          </div>
          {r.seat?.label && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Seat</dt>
              <Armchair className="size-3.5 shrink-0 text-muted" aria-hidden />
              <dd>Seat {r.seat.label}</dd>
            </div>
          )}
          {f?.building?.name && (
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">Location</dt>
              <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden />
              <dd className="truncate">{[f.building.name, f.floor_label].filter(Boolean).join(" · ")}</dd>
            </div>
          )}
        </dl>
        {(r.checked_in_at || r.checked_out_at) && (
          <p className="tabular mt-2 text-xs text-muted">
            {r.checked_in_at && <>In {formatTime(r.checked_in_at)}</>}
            {r.checked_out_at && <> · Out {formatTime(r.checked_out_at)}</>}
          </p>
        )}
      </div>
      <ArrowUpRight className="absolute bottom-3 right-3 size-4 text-forest opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
    </article>
  );
}
