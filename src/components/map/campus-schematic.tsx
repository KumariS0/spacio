"use client";

import { cn } from "@/lib/cn";
import { occupancyLevel, occupancyPercent } from "@/lib/occupancy";
import type { Availability, Facility } from "@/lib/types";
import { CategoryIcon } from "@/components/spaces/facility-icon";

export type SchematicFacility = Pick<Facility, "id" | "slug" | "name" | "category" | "map_x" | "map_y" | "booking_mode" | "building" | "floor_label">;

export function schematicPosition(f: SchematicFacility) {
  const x = f.map_x ?? f.building?.map_x;
  const y = f.map_y ?? f.building?.map_y;
  return x != null && y != null ? { x: Number(x), y: Number(y) } : null;
}

const levelColor = {
  plenty: "bg-ok",
  moderate: "bg-moderate-bar",
  busy: "bg-busy",
  full: "bg-busy",
  none: "bg-off",
};

/**
 * A stylised, NOT-TO-SCALE campus diagram. Positions are percentages set by
 * administrators (map_x / map_y). It never implies real geography.
 */
export function CampusSchematic({
  facilities,
  availability,
  selectedId,
  onSelect,
  compact,
  className,
}: {
  facilities: SchematicFacility[];
  availability?: Record<string, Availability | undefined>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const placed = facilities.map((f) => ({ f, pos: schematicPosition(f) })).filter((p) => p.pos);
  const buildings = new Map<string, { name: string; x: number; y: number }>();
  for (const { f } of placed) {
    if (f.building && f.building.map_x != null && f.building.map_y != null) {
      buildings.set(f.building.id, { name: f.building.name, x: Number(f.building.map_x), y: Number(f.building.map_y) });
    }
  }

  return (
    <div className={cn("relative aspect-[10/7] w-full overflow-hidden rounded-card border border-line bg-[#e6ecdc]", className)}>
      <svg viewBox="0 0 1000 700" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="none">
        <rect width="1000" height="700" fill="#e4ebda" />
        <path d="M0 520 C180 470 260 600 470 560 S820 470 1000 520 V700 H0Z" fill="#d6e2cb" />
        <path d="M640 0 C700 120 860 140 1000 110 V0Z" fill="#d6e2cb" />
        <ellipse cx="470" cy="330" rx="88" ry="58" fill="#cfdcc3" />
        <g fill="none" stroke="#f6f1e3" strokeLinecap="round">
          <path d="M-20 300 C200 250 330 360 500 330 S800 230 1020 280" strokeWidth="26" />
          <path d="M470 -20 C440 160 520 250 470 330 S420 560 520 720" strokeWidth="22" />
          <path d="M120 720 C170 560 120 430 230 300" strokeWidth="16" />
          <path d="M760 720 C730 600 800 470 760 300" strokeWidth="16" />
        </g>
        <g fill="#bccfb0">
          {[
            [90, 110], [140, 160], [60, 220], [300, 90], [350, 140], [600, 610], [660, 640], [880, 380], [930, 330], [260, 620], [820, 610], [560, 190],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 18 : 13} />
          ))}
        </g>
        {[...buildings.values()].map((b) => (
          <rect key={b.name} x={b.x * 10 - 46} y={b.y * 7 - 30} width="92" height="60" rx="10" fill="#efe6d2" stroke="#d9cdb2" strokeWidth="2" />
        ))}
      </svg>

      {!compact &&
        [...buildings.values()].map((b) => (
          <span
            key={b.name}
            className="pointer-events-none absolute -translate-x-1/2 translate-y-[18px] whitespace-nowrap text-[10px] font-medium text-ink-soft/70"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
          >
            {b.name}
          </span>
        ))}

      {placed.map(({ f, pos }) => {
        const a = availability?.[f.id];
        const pct = occupancyPercent(a?.capacity, a?.available);
        const level = occupancyLevel(f.booking_mode === "none" ? null : pct);
        const selected = selectedId === f.id;
        const Tag = onSelect ? "button" : "span";
        return (
          <Tag
            key={f.id}
            {...(onSelect ? { type: "button" as const, onClick: () => onSelect(f.id), "aria-pressed": selected } : {})}
            aria-label={`${f.name}${pct != null && f.booking_mode !== "none" ? `, ${pct}% occupied` : ""}`}
            className={cn(
              "absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center transition-transform duration-200",
              selected ? "z-20 scale-110" : onSelect && "hover:scale-105",
            )}
            style={{ left: `${pos!.x}%`, top: `${pos!.y}%` }}
          >
            {!compact && (
              <span
                className={cn(
                  "mb-1 flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-surface px-2 py-0.5 text-[11px] font-medium shadow-card",
                  selected ? "border-forest text-forest" : "border-line text-ink",
                )}
              >
                <span aria-hidden className={cn("size-1.5 rounded-full", levelColor[level])} />
                {f.name}
                {pct != null && f.booking_mode !== "none" && <span className="tabular text-muted">{pct}%</span>}
              </span>
            )}
            <span className={cn("grid size-8 place-items-center rounded-full border-2 border-surface text-white shadow-pop", selected ? "bg-forest-deep" : "bg-forest")}>
              <CategoryIcon category={f.category} className="size-4" />
            </span>
            <span aria-hidden className="-mt-1 size-2 rotate-45 bg-forest" />
          </Tag>
        );
      })}

      <span className="absolute bottom-2 left-2 rounded-md bg-surface/85 px-2 py-0.5 text-[10px] font-medium text-muted">Schematic · not to scale</span>
    </div>
  );
}
