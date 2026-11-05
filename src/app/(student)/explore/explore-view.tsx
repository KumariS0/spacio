"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Heart, Map, Search, SlidersHorizontal, X } from "lucide-react";
import { SpaceCard } from "@/components/spaces/space-card";
import { useLive, LiveIndicator } from "@/components/live/live-availability";
import { PageHeader } from "@/components/nav/page-header";
import { ButtonLink, Button } from "@/components/ui/button";
import { DemoNote, EmptyState } from "@/components/ui/misc";
import { inputClass } from "@/components/ui/field";
import { occupancyPercent } from "@/lib/occupancy";
import type { Category, Facility } from "@/lib/types";
import { cn } from "@/lib/cn";

export type ExploreParams = { q?: string; category?: string; open?: string; occ?: string; fav?: string; book?: string; sort?: string };

type Sort = "available" | "quietest" | "name";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-150",
        active ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-soft hover:border-forest/35 hover:text-forest",
      )}
    >
      {children}
    </button>
  );
}

export function ExploreView({
  facilities,
  categories,
  favoriteIds,
  initialParams,
}: {
  facilities: Facility[];
  categories: Category[];
  favoriteIds: string[];
  initialParams: ExploreParams;
}) {
  const pathname = usePathname();
  const live = useLive();
  const favs = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const [q, setQ] = useState(initialParams.q ?? "");
  const [category, setCategory] = useState(initialParams.category ?? "all");
  const [openNow, setOpenNow] = useState(initialParams.open === "1");
  const [occ, setOcc] = useState<"any" | "70" | "40">(initialParams.occ === "70" || initialParams.occ === "40" ? initialParams.occ : "any");
  const [favOnly, setFavOnly] = useState(initialParams.fav === "1");
  const [bookableOnly, setBookableOnly] = useState(initialParams.book === "1");
  const [sort, setSort] = useState<Sort>((["available", "quietest", "name"] as const).find((s) => s === initialParams.sort) ?? "available");
  const [showFilters, setShowFilters] = useState(Boolean(initialParams.open || initialParams.occ || initialParams.book));
  const query = useDeferredValue(q);

  function syncUrl(next: Partial<Record<keyof ExploreParams, string | null>>) {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "" || v === "all" || v === "any") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    // Shallow URL update (shareable/back-able) without a server round trip.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const catName = Object.fromEntries(categories.map((c) => [c.slug, c.name.toLowerCase()]));
    const list = facilities.filter((f) => {
      const a = live?.byId[f.id];
      if (category !== "all" && f.category !== category) return false;
      if (favOnly && !favs.has(f.id)) return false;
      if (bookableOnly && f.booking_mode === "none") return false;
      if (openNow && !(a?.is_open_now && !f.is_temporarily_closed)) return false;
      if (occ !== "any") {
        const pct = occupancyPercent(a?.capacity, a?.available);
        if (pct == null || pct >= Number(occ)) return false;
      }
      if (!needle) return true;
      return [f.name, f.tagline, f.building?.name, f.building?.code, f.floor_label, catName[f.category], f.category]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
    const freeOf = (f: Facility) => live?.byId[f.id]?.available ?? -1;
    const pctOf = (f: Facility) => occupancyPercent(live?.byId[f.id]?.capacity, live?.byId[f.id]?.available) ?? 101;
    return list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "quietest") return pctOf(a) - pctOf(b) || a.name.localeCompare(b.name);
      return freeOf(b) - freeOf(a) || a.name.localeCompare(b.name);
    });
  }, [facilities, categories, live, query, category, favOnly, bookableOnly, openNow, occ, sort, favs]);

  const activeFilters = Number(openNow) + Number(occ !== "any") + Number(bookableOnly);
  const isSearch = Boolean(query.trim());

  function resetAll() {
    setQ("");
    setCategory("all");
    setOpenNow(false);
    setOcc("any");
    setFavOnly(false);
    setBookableOnly(false);
    setSort("available");
    window.history.replaceState(null, "", pathname);
  }

  return (
    <div>
      <PageHeader
        title={isSearch ? "Search results" : "Explore spaces"}
        description="Live availability for every space on campus."
        actions={
          <ButtonLink href="/map" variant="secondary" size="sm" icon={<Map className="size-4" aria-hidden />}>
            Map
          </ButtonLink>
        }
      />

      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-transparent bg-paper/95 px-4 pb-3 pt-1 backdrop-blur-md sm:-mx-6 sm:px-6 md:top-16">
        <div className="flex gap-2">
          <div role="search" className="relative flex-1">
            <label htmlFor="explore-search" className="sr-only">Search campus spaces</label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="explore-search"
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                syncUrl({ q: e.target.value });
              }}
              placeholder="Search by name, building or type"
              className={cn(inputClass, "pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden")}
              autoComplete="off"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  syncUrl({ q: null });
                }}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant={showFilters || activeFilters ? "quiet" : "secondary"}
            className="relative h-12 w-12 px-0"
            aria-expanded={showFilters}
            aria-controls="explore-filters"
            aria-label={`Filters${activeFilters ? ` (${activeFilters} active)` : ""}`}
            onClick={() => setShowFilters((s) => !s)}
          >
            <SlidersHorizontal className="size-4.5" aria-hidden />
            {activeFilters > 0 && (
              <span className="tabular absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-forest text-[11px] font-semibold text-white">{activeFilters}</span>
            )}
          </Button>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6" role="group" aria-label="Space type">
          <Chip active={category === "all" && !favOnly} onClick={() => { setCategory("all"); setFavOnly(false); syncUrl({ category: null, fav: null }); }}>
            All spaces
          </Chip>
          <Chip active={favOnly} onClick={() => { setFavOnly(!favOnly); syncUrl({ fav: favOnly ? null : "1" }); }}>
            <Heart className={cn("size-3.5", favOnly && "fill-current")} aria-hidden /> Saved
          </Chip>
          {categories
            .filter((c) => facilities.some((f) => f.category === c.slug))
            .map((c) => (
              <Chip key={c.slug} active={category === c.slug} onClick={() => { const next = category === c.slug ? "all" : c.slug; setCategory(next); syncUrl({ category: next }); }}>
                {c.name}
              </Chip>
            ))}
        </div>

        {showFilters && (
          <div id="explore-filters" className="grid animate-rise gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-3">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Availability</legend>
              <div className="flex flex-wrap gap-2">
                <Chip active={!openNow} onClick={() => { setOpenNow(false); syncUrl({ open: null }); }}>Any</Chip>
                <Chip active={openNow} onClick={() => { setOpenNow(true); syncUrl({ open: "1" }); }}>Open now</Chip>
                <Chip active={bookableOnly} onClick={() => { setBookableOnly(!bookableOnly); syncUrl({ book: bookableOnly ? null : "1" }); }}>Bookable</Chip>
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Occupancy</legend>
              <div className="flex flex-wrap gap-2">
                {(["any", "70", "40"] as const).map((o) => (
                  <Chip key={o} active={occ === o} onClick={() => { setOcc(o); syncUrl({ occ: o }); }}>
                    {o === "any" ? "Any" : `Under ${o}%`}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <div className="flex items-end justify-between gap-3 sm:justify-end">
              <Button variant="ghost" size="sm" onClick={resetAll}>Reset all</Button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          <span className="tabular font-medium text-ink">{results.length}</span> {results.length === 1 ? "space" : "spaces"}
          {isSearch && <> for “{query.trim()}”</>}
          <LiveIndicator className="ml-3 align-middle" />
        </p>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="hidden sm:inline">Sort by</span>
          <select
            value={sort}
            onChange={(e) => { const s = e.target.value as Sort; setSort(s); syncUrl({ sort: s === "available" ? null : s }); }}
            className="h-9 rounded-[9px] border border-line bg-surface px-2.5 text-sm text-ink focus:border-forest focus:outline-none"
            aria-label="Sort spaces"
          >
            <option value="available">Most free places</option>
            <option value="quietest">Least busy</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      {results.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {results.map((f, i) => (
            <li key={f.id}>
              <SpaceCard facility={f} availability={live?.byId[f.id]} isFavorite={favs.has(f.id)} priority={i < 2} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Search className="size-5" aria-hidden />}
          title="No spaces match"
          action={<Button variant="secondary" onClick={resetAll}>Clear search and filters</Button>}
        >
          {favOnly && !favs.size ? "You haven't saved any spaces yet. Tap the heart on a space to save it." : "Try a different name, or loosen the filters."}
        </EmptyState>
      )}
      {facilities.some((f) => f.is_demo) && <DemoNote className="mt-6" />}
    </div>
  );
}
