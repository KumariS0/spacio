"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, List, Map as MapIcon, MapPin, Search } from "lucide-react";
import { useLive, LiveIndicator } from "@/components/live/live-availability";
import { PageHeader } from "@/components/nav/page-header";
import { SpaceCard } from "@/components/spaces/space-card";
import { locationLine } from "@/lib/location";
import { OccupancyMeter, OpenStatus } from "@/components/spaces/occupancy";
import { CategoryIcon } from "@/components/spaces/facility-icon";
import { Alert, DemoNote, EmptyState, Skeleton } from "@/components/ui/misc";
import { inputClass } from "@/components/ui/field";
import type { Facility } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CampusSchematic, schematicPosition } from "./campus-schematic";

const StreetMap = dynamic(() => import("./street-map"), { ssr: false, loading: () => <Skeleton className="aspect-[10/7] w-full rounded-card" /> });

type Surface = "schematic" | "street";

export function MapView({
  facilities,
  favoriteIds,
  initialFocusId,
  initialView,
  mapCenter,
}: {
  facilities: Facility[];
  favoriteIds: string[];
  initialFocusId: string | null;
  initialView: "map" | "list";
  mapCenter: { lat: number; lng: number; zoom: number } | null;
}) {
  const live = useLive();
  const favs = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const [view, setView] = useState(initialView);
  const [surface, setSurface] = useState<Surface>("schematic");
  const [selected, setSelected] = useState<string | null>(initialFocusId ?? null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return facilities.filter((f) => !n || [f.name, f.building?.name, f.floor_label, f.category].filter(Boolean).some((s) => String(s).toLowerCase().includes(n)));
  }, [facilities, q]);
  const geo = facilities.filter((f) => (f.lat ?? f.building?.lat) != null);
  const unplaced = facilities.filter((f) => !schematicPosition(f));
  const sel = facilities.find((f) => f.id === selected) ?? null;
  const selAvail = sel ? live?.byId[sel.id] : undefined;

  return (
    <div>
      <PageHeader
        title="Campus map"
        description="Where each space is, and how busy it is right now."
        actions={
          <div role="tablist" aria-label="View" className="flex rounded-[10px] border border-line bg-surface p-1">
            {(["map", "list"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-sm transition-colors",
                  view === v ? "bg-forest text-white" : "text-ink-soft hover:text-ink",
                )}
              >
                {v === "map" ? <MapIcon className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
                {v === "map" ? "Map view" : "List view"}
              </button>
            ))}
          </div>
        }
      />

      {view === "list" ? (
        <div>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {facilities.length} spaces on campus
            </span>
            <LiveIndicator />
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {facilities.map((f) => (
              <li key={f.id}>
                <SpaceCard facility={f} availability={live?.byId[f.id]} isFavorite={favs.has(f.id)} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" aria-label="Map type" className="flex gap-1 text-sm">
                {(["schematic", "street"] as const).map((s) => (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={surface === s}
                    onClick={() => setSurface(s)}
                    className={cn("h-8 rounded-full border px-3 transition-colors", surface === s ? "border-forest bg-forest-tint text-forest-deep" : "border-line bg-surface text-ink-soft")}
                  >
                    {s === "schematic" ? "Campus schematic" : "Street map"}
                  </button>
                ))}
              </div>
              <LiveIndicator />
            </div>

            {surface === "schematic" ? (
              <CampusSchematic facilities={facilities} availability={live?.byId} selectedId={selected} onSelect={setSelected} className="min-h-[300px]" />
            ) : mapCenter && geo.length ? (
              <StreetMap center={mapCenter} facilities={geo} availability={live?.byId ?? {}} selectedId={selected} onSelect={setSelected} />
            ) : (
              <EmptyState icon={<MapIcon className="size-5" aria-hidden />} title="No verified coordinates yet" className="aspect-[10/7] justify-center">
                The street map only shows spaces whose real-world location has been entered and verified by an administrator, so it never shows
                guessed pins. Use the campus schematic meanwhile.
              </EmptyState>
            )}

            {unplaced.length > 0 && surface === "schematic" && (
              <p className="text-xs text-muted">{unplaced.length} space{unplaced.length > 1 ? "s haven't" : " hasn't"} been placed on the map yet.</p>
            )}

            {sel && (
              <div className="animate-rise rounded-card border border-forest/25 bg-surface p-4 shadow-pop" aria-live="polite">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-white">
                    <CategoryIcon category={sel.category} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-xl text-ink">{sel.name}</h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[13px] text-muted">
                      <OpenStatus availability={selAvail} closed={sel.is_temporarily_closed} />
                      <span>{locationLine(sel)}</span>
                    </div>
                  </div>
                  <Link href={`/spaces/${sel.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
                    Details <ArrowUpRight className="size-4" aria-hidden />
                  </Link>
                </div>
                <OccupancyMeter availability={selAvail} className="mt-3" />
              </div>
            )}
            {facilities.some((f) => f.is_demo) && <DemoNote />}
          </div>

          <aside aria-label="Spaces" className="space-y-3">
            <div className="relative">
              <label htmlFor="map-search" className="sr-only">Search spaces on the map</label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
              <input id="map-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search spaces" className={cn(inputClass, "pl-10")} />
            </div>
            <ul className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
              {filtered.map((f) => {
                const a = live?.byId[f.id];
                const pct = a?.capacity ? Math.round(((a.capacity - (a.available ?? 0)) / a.capacity) * 100) : null;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(f.id)}
                      aria-pressed={selected === f.id}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors",
                        selected === f.id ? "border-forest/40 bg-forest-wash" : "border-transparent hover:bg-surface",
                      )}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-tint text-forest">
                        <CategoryIcon category={f.category} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
                        <span className="block truncate text-xs text-muted">{locationLine(f)}</span>
                      </span>
                      {pct != null && f.booking_mode !== "none" && <span className="tabular text-xs text-muted">{pct}%</span>}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="px-3 py-4 text-sm text-muted">No spaces match “{q}”.</li>}
            </ul>
            {surface === "street" && !mapCenter && (
              <Alert tone="info">Set NEXT_PUBLIC_MAP_CENTER_LAT/LNG to enable the street map once coordinates are verified.</Alert>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
