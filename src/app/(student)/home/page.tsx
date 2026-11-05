import type { Reservation } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Compass, Heart, Map, QrCode, Search, User } from "lucide-react";
import { availabilityMap, getAvailability, getCampusStats, getCategories, getFacilities, getFavoriteIds, getMyReservations, requireStudent } from "@/lib/data";
import { LiveAvailabilityProvider, LiveIndicator } from "@/components/live/live-availability";
import { LiveStats } from "@/components/spaces/live-stats";
import { SpaceCard } from "@/components/spaces/space-card";
import { CategoryIcon } from "@/components/spaces/facility-icon";
import { BookingCard } from "@/components/bookings/booking-card";
import { DemoNote, SectionHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { greeting } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Home" };

const QUICK = [
  { href: "/explore", label: "Explore spaces", icon: Compass },
  { href: "/map", label: "Campus map", icon: Map },
  { href: "/bookings", label: "My bookings", icon: CalendarDays },
  { href: "/saved", label: "Saved", icon: Heart },
  { href: "/profile", label: "Profile", icon: User },
];

export default async function HomePage() {
  const viewer = await requireStudent();
  const [facilities, availability, stats, categories, favoriteIds, reservations] = await Promise.all([
    getFacilities(),
    getAvailability(),
    getCampusStats(),
    getCategories(),
    getFavoriteIds(),
    getMyReservations({ limit: 20 }),
  ]);
  const avail = availabilityMap(availability);
  const favs = new Set(favoriteIds);
  const firstName = (viewer.profile.full_name ?? "").split(" ")[0];
  const next = nextActiveReservation(reservations);

  // Favourites first, then bookable spaces, then the rest.
  const popular = [...facilities]
    .sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)) || Number(b.booking_mode !== "none") - Number(a.booking_mode !== "none"))
    .slice(0, 6);
  const usedCategories = categories.filter((c) => facilities.some((f) => f.category === c.slug));

  return (
    <LiveAvailabilityProvider initial={availability}>
      <div className="space-y-9">
        <section aria-labelledby="greeting">
          <div className="flex items-end justify-between gap-4">
            <h1 id="greeting" className="text-[30px] leading-tight text-ink sm:text-[36px]">
              {greeting()}, {firstName}
            </h1>
            <LiveIndicator className="mb-2 hidden sm:inline-flex" />
          </div>
          <form action="/explore" role="search" className="relative mt-5 max-w-2xl">
            <label htmlFor="home-search" className="sr-only">Search campus spaces</label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
            <input id="home-search" name="q" type="search" placeholder="Search the library, gym, a building…" className={cn(inputClass, "pl-10 pr-24")} />
            <button type="submit" className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-[8px] bg-forest px-3.5 text-sm font-medium text-white hover:bg-forest-deep">
              Search
            </button>
          </form>
        </section>

        {next && (
          <section aria-labelledby="next-title">
            <SectionHeader
              id="next-title"
              title={next.status === "CHECKED_IN" ? "You're checked in" : "Your next booking"}
              action={
                <ButtonLink href={`/bookings/${next.id}#pass`} size="sm" variant={next.status === "CHECKED_IN" ? "secondary" : "primary"} icon={<QrCode className="size-4" aria-hidden />}>
                  {next.status === "CHECKED_IN" ? "Show pass to check out" : "Show pass"}
                </ButtonLink>
              }
            />
            <BookingCard reservation={next} />
          </section>
        )}

        <section aria-labelledby="stats-title">
          <SectionHeader id="stats-title" title="Campus right now" action={<LiveIndicator className="sm:hidden" />} />
          <LiveStats initial={stats} />
        </section>

        <section aria-labelledby="find-title">
          <SectionHeader id="find-title" title="Find your space" />
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {usedCategories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/explore?category=${c.slug}`}
                  className="flex h-full flex-col items-center gap-2 rounded-card border border-line bg-surface px-2 py-3.5 text-center text-[13px] font-medium text-ink-soft transition-colors hover:border-forest/30 hover:bg-forest-wash hover:text-forest"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-forest-tint text-forest">
                    <CategoryIcon icon={c.icon} className="size-5" />
                  </span>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="spaces-title">
          <SectionHeader
            id="spaces-title"
            title="Spaces on campus"
            action={
              <Link href="/explore" className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
                Explore all <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          {popular.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {popular.map((f, i) => (
                <li key={f.id}>
                  <SpaceCard facility={f} availability={avail[f.id]} isFavorite={favs.has(f.id)} priority={i < 2} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No spaces have been added yet. An administrator can add them from the admin dashboard.</p>
          )}
          {facilities.some((f) => f.is_demo) && <DemoNote className="mt-4" />}
        </section>

        <nav aria-label="Quick links">
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {QUICK.map(({ href, label, icon: Icon }) => (
              <li key={href} className="shrink-0">
                <Link href={href} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-ink-soft hover:border-forest/30 hover:text-forest">
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </LiveAvailabilityProvider>
  );
}

function nextActiveReservation(reservations: Reservation[]) {
  const now = Date.now();
  return reservations
    .filter((r) => (r.status === "BOOKED" || r.status === "CHECKED_IN") && new Date(r.ends_at).getTime() > now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
}
