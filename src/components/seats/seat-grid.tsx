"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SeatMapRow, SeatState } from "@/lib/types";

const STATE_LABEL: Record<SeatState, string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  unavailable: "Unavailable",
};

const STATE_STYLE: Record<SeatState, string> = {
  available: "border-ok/55 bg-ok-tint text-ok-ink hover:border-ok hover:bg-[#cfe5d4] cursor-pointer",
  reserved:
    "border-reserved/50 bg-reserved-tint text-reserved-ink bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(184_101_27/0.14)_5px_7px)]",
  occupied: "border-busy/50 bg-busy-tint text-busy-ink",
  unavailable: "border-dashed border-off/60 bg-off-tint text-off-ink",
};

export function SeatLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft", className)} aria-label="Seat legend">
      {(Object.keys(STATE_LABEL) as SeatState[]).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("grid size-4 place-items-center rounded-[4px] border", STATE_STYLE[s].replace(/hover:\S+|cursor-pointer/g, ""))}>
            {s === "occupied" && <span className="size-1.5 rounded-full bg-busy" />}
            {s === "unavailable" && <X className="size-2.5" />}
          </span>
          {STATE_LABEL[s]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-4 rounded-[4px] border-2 border-forest bg-forest-tint" />
        Yours
      </li>
    </ul>
  );
}

/**
 * Seat layout grouped by row. Rows/columns come from the database, so admins
 * can reshape the layout without code changes.
 */
export function SeatGrid({
  seats,
  selectedId,
  onSelect,
  readOnly,
  className,
}: {
  seats: SeatMapRow[];
  selectedId?: string | null;
  onSelect?: (seat: SeatMapRow) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const rows = new Map<string, SeatMapRow[]>();
  for (const s of seats) rows.set(s.row_label, [...(rows.get(s.row_label) ?? []), s]);
  const sorted = [...rows.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const maxCol = Math.max(1, ...seats.map((s) => s.col_index));

  return (
    <div className={cn("overflow-x-auto rounded-card border border-line bg-surface p-3 sm:p-5", className)}>
      <div className="mx-auto w-max min-w-full">
        <div className="mb-4 rounded-md bg-sunken py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Entrance</div>
        <div role={readOnly ? "list" : "radiogroup"} aria-label="Seats" className="space-y-2">
          {sorted.map(([row, rowSeats]) => {
            const byCol = new Map(rowSeats.map((s) => [s.col_index, s]));
            return (
              <div key={row} className="flex items-center gap-2" role="presentation">
                <span className="w-5 shrink-0 text-center font-serif text-sm text-muted" aria-hidden>
                  {row}
                </span>
                <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${maxCol}, minmax(2.5rem, 3rem))` }}>
                  {Array.from({ length: maxCol }, (_, i) => {
                    const seat = byCol.get(i + 1);
                    if (!seat) return <span key={i} aria-hidden />;
                    const selectable = !readOnly && seat.state === "available";
                    const selected = selectedId === seat.seat_id;
                    const label = `Seat ${seat.label}, ${seat.is_mine ? "your booking" : STATE_LABEL[seat.state].toLowerCase()}`;
                    const common = cn(
                      "relative grid aspect-square place-items-center rounded-[8px] border text-[11px] font-semibold tabular transition-[transform,background-color,border-color,box-shadow] duration-150",
                      STATE_STYLE[seat.state],
                      seat.is_mine && "border-2 border-forest",
                      selected && "scale-[1.04] border-forest bg-forest text-white shadow-pop hover:bg-forest hover:border-forest",
                      !selectable && "cursor-default",
                    );
                    const inner = (
                      <>
                        {selected ? <Check className="size-4" aria-hidden /> : seat.label}
                        {seat.state === "occupied" && !selected && <span aria-hidden className="absolute right-1 top-1 size-1.5 rounded-full bg-busy" />}
                        {seat.is_mine && !selected && <span aria-hidden className="absolute -top-2 rounded-full bg-forest px-1 text-[9px] font-semibold leading-tight text-white">You</span>}
                      </>
                    );
                    if (readOnly) {
                      return (
                        <span key={seat.seat_id} role="listitem" aria-label={label} title={label} className={common}>
                          {inner}
                        </span>
                      );
                    }
                    return (
                      <button
                        key={seat.seat_id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={label}
                        title={label}
                        disabled={!selectable}
                        onClick={() => selectable && onSelect?.(seat)}
                        className={cn(common, selectable && "active:scale-95")}
                      >
                        {inner}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
