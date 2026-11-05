"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Armchair, CalendarDays, Clock, LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getBrowserClient } from "@/lib/supabase/client";
import { useFacilityLive } from "@/components/live/use-facility-live";
import { createBooking } from "@/actions/bookings";
import { SeatGrid, SeatLegend } from "@/components/seats/seat-grid";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/misc";
import { durationLabel, formatLongDay, formatRange, formatTime, upcomingDates } from "@/lib/time";
import type { BookingMode, SeatMapRow, Slot } from "@/lib/types";
import { cn } from "@/lib/cn";

type FacilityLite = {
  id: string;
  slug: string;
  name: string;
  booking_mode: BookingMode;
  slot_minutes: number;
  max_booking_minutes: number;
  no_show_grace_minutes: number;
};

export function BookingFlow({ facility, horizonDays }: { facility: FacilityLite; horizonDays: number }) {
  const router = useRouter();
  const dates = useMemo(() => upcomingDates(horizonDays), [horizonDays]);
  const [date, setDate] = useState(dates[0].iso);
  // Results are tagged with what they were loaded for, so stale data is never shown
  // after the date or time changes (no state resets inside effects).
  const [slotState, setSlotState] = useState<{ date: string; rows: Slot[] } | null>(null);
  const slots = slotState?.date === date ? slotState.rows : null;
  const [slotError, setSlotError] = useState(false);
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [length, setLength] = useState(1);
  const [seatState, setSeatState] = useState<{ key: string; rows: SeatMapRow[] } | null>(null);
  const [seatId, setSeatId] = useState<string | null>(null);
  const seatRef = useRef<string | null>(null);
  useEffect(() => {
    seatRef.current = seatId;
  }, [seatId]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isSeat = facility.booking_mode === "seat";
  const maxSlots = Math.max(1, Math.floor(facility.max_booking_minutes / facility.slot_minutes));

  const fetchSlots = useCallback(async (): Promise<Slot[] | null> => {
    const { data, error } = await getBrowserClient().rpc("get_facility_slots", { p_facility_id: facility.id, p_date: date });
    return error ? null : ((data ?? []) as Slot[]);
  }, [facility.id, date]);

  const applySlots = useCallback(
    (rows: Slot[] | null) => {
      setSlotError(rows == null);
      if (rows) setSlotState({ date, rows });
    },
    [date],
  );

  const loadSlots = useCallback(() => fetchSlots().then(applySlots), [fetchSlots, applySlots]);

  useEffect(() => {
    let current = true;
    fetchSlots().then((rows) => current && applySlots(rows));
    return () => {
      current = false;
    };
  }, [fetchSlots, applySlots]);

  const openSlots = useMemo(() => (slots ?? []).filter((s) => !s.is_past), [slots]);

  // How many consecutive slots can follow the chosen start (respecting hours and, for capacity, availability).
  const maxLength = useMemo(() => {
    if (startIdx == null) return 1;
    let n = 1;
    while (n < maxSlots) {
      const prev = openSlots[startIdx + n - 1];
      const next = openSlots[startIdx + n];
      if (!next || next.slot_start !== prev.slot_end) break;
      if (!isSeat && next.available <= 0) break;
      n++;
    }
    return n;
  }, [startIdx, openSlots, maxSlots, isSeat]);

  const window_ = useMemo(() => {
    if (startIdx == null) return null;
    const len = Math.min(length, maxLength);
    const first = openSlots[startIdx];
    const last = openSlots[startIdx + len - 1];
    if (!first || !last) return null;
    return { start: first.slot_start, end: last.slot_end, minutes: len * facility.slot_minutes };
  }, [startIdx, length, maxLength, openSlots, facility.slot_minutes]);

  const seats = window_ && seatState?.key === `${window_.start}|${window_.end}` ? seatState.rows : null;

  const fetchSeats = useCallback(async (): Promise<{ key: string; rows: SeatMapRow[] } | null> => {
    if (!isSeat || !window_) return null;
    const { data, error } = await getBrowserClient().rpc("get_seat_map", {
      p_facility_id: facility.id,
      p_from: window_.start,
      p_to: window_.end,
    });
    if (error) return null;
    return { key: `${window_.start}|${window_.end}`, rows: (data ?? []) as SeatMapRow[] };
  }, [isSeat, window_, facility.id]);

  const applySeats = useCallback((result: { key: string; rows: SeatMapRow[] } | null) => {
    if (!result) return;
    const { rows } = result;
    setSeatState(result);
    // Drop a selection that is no longer available (someone else booked it).
    const current = seatRef.current;
    if (current && rows.find((r) => r.seat_id === current)?.state !== "available") {
      setSeatId(null);
      toast.warning("The seat you picked was just taken. Please choose another.");
    }
  }, []);

  const loadSeats = useCallback(() => fetchSeats().then(applySeats), [fetchSeats, applySeats]);

  useEffect(() => {
    let current = true;
    fetchSeats().then((r) => current && applySeats(r));
    return () => {
      current = false;
    };
  }, [fetchSeats, applySeats]);

  useFacilityLive(facility.id, () => {
    loadSlots();
    loadSeats();
  });

  const selectedSeat = seats?.find((s) => s.seat_id === seatId) ?? null;
  const canReserve = Boolean(window_ && (!isSeat || selectedSeat));

  function reserve() {
    if (!window_) return;
    setError(null);
    startTransition(async () => {
      const res = await createBooking({ facilityId: facility.id, seatId: isSeat ? seatId : null, startsAt: window_.start, endsAt: window_.end });
      if (res.ok) {
        router.push(`/bookings/${res.id}/confirmed`);
        return;
      }
      setError(res.error);
      toast.error(res.error);
      if (res.code === "SEAT_TAKEN") setSeatId(null);
      loadSlots();
      loadSeats();
    });
  }

  const dateLabel = dates.find((d) => d.iso === date)?.label;

  return (
    <div className="pb-28 md:pb-0">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8">
          {/* 1 · Date */}
          <section aria-labelledby="step-date">
            <h2 id="step-date" className="mb-3 flex items-center gap-2 text-lg text-ink">
              <StepNumber n={1} /> Pick a day
            </h2>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Day">
              {dates.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  role="radio"
                  aria-checked={date === d.iso}
                  onClick={() => {
                    setDate(d.iso);
                    setStartIdx(null);
                    setSeatId(null);
                  }}
                  className={cn(
                    "h-10 shrink-0 rounded-full border px-4 text-sm transition-colors",
                    date === d.iso ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-soft hover:border-forest/35",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </section>

          {/* 2 · Time */}
          <section aria-labelledby="step-time">
            <h2 id="step-time" className="mb-3 flex items-center gap-2 text-lg text-ink">
              <StepNumber n={2} /> Choose a start time
            </h2>
            {slotError ? (
              <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={loadSlots} icon={<RefreshCw className="size-4" />}>Try again</Button>}>
                We couldn&apos;t load time slots. Check your connection.
              </Alert>
            ) : slots == null ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-14 rounded-[10px]" />)}
              </div>
            ) : openSlots.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-5" aria-hidden />} title="No slots left on this day">
                The space is closed or every slot has passed. Try another day.
              </EmptyState>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" role="radiogroup" aria-label="Start time">
                {openSlots.map((s, i) => {
                  const full = s.available <= 0;
                  const selected = startIdx === i;
                  const inRange = window_ && startIdx != null && i > startIdx && i < startIdx + Math.min(length, maxLength);
                  return (
                    <button
                      key={s.slot_start}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={full}
                      onClick={() => {
                        setStartIdx(i);
                        setLength(1);
                        setSeatId(null);
                      }}
                      aria-label={`${formatTime(s.slot_start)}, ${full ? "full" : `${s.available} ${isSeat ? "seats" : "places"} free`}`}
                      className={cn(
                        "flex h-14 flex-col items-center justify-center rounded-[10px] border text-sm transition-colors",
                        selected
                          ? "border-forest bg-forest text-white"
                          : inRange
                            ? "border-forest/40 bg-forest-tint text-forest-deep"
                            : full
                              ? "cursor-not-allowed border-line bg-sunken/60 text-muted line-through"
                              : "border-line bg-surface text-ink hover:border-forest/40",
                      )}
                    >
                      <span className="tabular font-medium">{formatTime(s.slot_start)}</span>
                      <span className={cn("tabular text-[11px]", selected ? "text-white/80" : "text-muted")}>{full ? "Full" : `${s.available} free`}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {startIdx != null && maxSlots > 1 && (
              <div className="mt-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Duration">
                <span className="mr-1 text-sm text-muted">Duration</span>
                {Array.from({ length: maxSlots }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={length === n}
                    disabled={n > maxLength}
                    onClick={() => {
                      setLength(n);
                      setSeatId(null);
                    }}
                    className={cn(
                      "h-9 rounded-full border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      length === n ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-soft hover:border-forest/35",
                    )}
                  >
                    {durationLabel(n * facility.slot_minutes)}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 3 · Seat */}
          {isSeat && (
            <section aria-labelledby="step-seat">
              <h2 id="step-seat" className="mb-1 flex items-center gap-2 text-lg text-ink">
                <StepNumber n={3} /> Pick your seat
              </h2>
              <p className="mb-3 text-sm text-muted">
                {window_ ? `Showing seats for ${formatRange(window_.start, window_.end)}. Updates live.` : "Choose a time first to see which seats are free."}
              </p>
              {window_ ? (
                seats ? (
                  <div className="space-y-3">
                    <SeatGrid seats={seats} selectedId={seatId} onSelect={(s) => setSeatId(s.seat_id)} />
                    <SeatLegend />
                  </div>
                ) : (
                  <Skeleton className="h-64 rounded-card" />
                )
              ) : (
                <div className="grid h-40 place-items-center rounded-card border border-dashed border-line-strong text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <Armchair className="size-4" aria-hidden /> Seat layout appears here
                  </span>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Summary */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-card border border-line bg-surface p-5 shadow-card">
            <Summary facility={facility} dateLabel={dateLabel} window_={window_} seatLabel={selectedSeat?.label} isSeat={isSeat} />
            {error && <Alert tone="error" className="mt-4">{error}</Alert>}
            <Button size="lg" className="mt-5 w-full" disabled={!canReserve} loading={pending} onClick={reserve}>
              {pending ? "Reserving…" : "Reserve"}
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Check in by scanning the QR at the entrance within {facility.no_show_grace_minutes} minutes of your start time, or the booking is released.
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile summary bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
        {error && <p role="alert" className="mb-2 text-sm text-busy">{error}</p>}
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {window_ ? (
              <>
                <p className="truncate font-medium text-ink">
                  {isSeat ? (selectedSeat ? `Seat ${selectedSeat.label}` : "Pick a seat") : facility.name}
                </p>
                <p className="tabular truncate text-muted">
                  {dateLabel} · {formatRange(window_.start, window_.end)}
                </p>
              </>
            ) : (
              <p className="text-muted">Choose a time to continue</p>
            )}
          </div>
          <Button size="lg" disabled={!canReserve} loading={pending} onClick={reserve} className="shrink-0">
            {pending ? "Reserving…" : "Reserve"}
          </Button>
        </div>
      </div>
      {pending && (
        <span className="sr-only" role="status">
          <LoaderCircle aria-hidden /> Reserving your place…
        </span>
      )}
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return <span className="tabular grid size-6 place-items-center rounded-full bg-forest-tint text-xs font-semibold text-forest">{n}</span>;
}

function Summary({
  facility,
  dateLabel,
  window_,
  seatLabel,
  isSeat,
}: {
  facility: FacilityLite;
  dateLabel?: string;
  window_: { start: string; end: string; minutes: number } | null;
  seatLabel?: string;
  isSeat: boolean;
}) {
  return (
    <div>
      <h2 className="font-serif text-xl text-ink">Your booking</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <Row icon={<CalendarDays className="size-4" />} label="Day" value={window_ ? `${dateLabel} · ${formatLongDay(window_.start)}` : "—"} />
        <Row icon={<Clock className="size-4" />} label="Time" value={window_ ? `${formatRange(window_.start, window_.end)} (${durationLabel(window_.minutes)})` : "—"} />
        {isSeat && <Row icon={<Armchair className="size-4" />} label="Seat" value={seatLabel ?? "—"} />}
      </dl>
      <p className="sr-only">{facility.name}</p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted" aria-hidden>{icon}</span>
      <div>
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="tabular text-ink">{value}</dd>
      </div>
    </div>
  );
}
