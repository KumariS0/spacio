import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/spaces/facility-icon";
import { ArrowLeft, Building2, CalendarPlus, Clock, Layers, Map, QrCode, Timer, Users } from "lucide-react";
import { getAvailability, getCategories, getFacilityBySlug, getFacilityDetails, getFavoriteIds, getSupabase } from "@/lib/data";
import { LiveAvailabilityProvider, LiveIndicator } from "@/components/live/live-availability";
import { FacilityImage } from "@/components/spaces/space-card";
import { FavoriteButton } from "@/components/spaces/favorite-button";
import { LiveFacilityPanel } from "@/components/spaces/live-facility-panel";
import { LiveSeatMap } from "@/components/seats/live-seat-map";
import { CampusSchematic } from "@/components/map/campus-schematic";
import { iconFor } from "@/components/spaces/facility-icon";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, DemoNote } from "@/components/ui/misc";
import { campusWeekday, durationLabel, formatClock, WEEKDAYS } from "@/lib/time";
import type { SeatMapRow } from "@/lib/types";
import { cn } from "@/lib/cn";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = await getFacilityBySlug((await params).slug);
  return { title: f?.name ?? "Space" };
}

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const facility = await getFacilityBySlug(slug);
  if (!facility || !facility.is_active) notFound();

  const supabase = await getSupabase();
  const [details, availability, favoriteIds, categories, seatMap] = await Promise.all([
    getFacilityDetails(facility.id),
    getAvailability([facility.id]),
    getFavoriteIds(),
    getCategories(),
    facility.booking_mode === "seat"
      ? supabase.rpc("get_seat_map", { p_facility_id: facility.id }).then((r) => (r.data ?? []) as SeatMapRow[])
      : Promise.resolve([] as SeatMapRow[]),
  ]);
  const category = categories.find((c) => c.slug === facility.category);
  const bookable = facility.booking_mode !== "none";
  const todayIdx = campusWeekday();
  const hasPosition = (facility.map_x ?? facility.building?.map_x) != null;

  return (
    <LiveAvailabilityProvider initial={availability} facilityIds={[facility.id]}>
      <Link href="/explore" className="-ml-2 mb-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-soft hover:bg-sunken hover:text-ink">
        <ArrowLeft className="size-4.5" aria-hidden /> Explore
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
        <div className="order-2 lg:order-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[34px] leading-tight text-ink sm:text-[40px]">{facility.name}</h1>
            <FavoriteButton facilityId={facility.id} facilityName={facility.name} isFavorite={favoriteIds.includes(facility.id)} withLabel className="mt-1.5 shrink-0" />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-wash px-2.5 py-0.5 text-[13px] font-medium text-forest-deep">
              <CategoryIcon category={facility.category} className="size-3.5" />
              {category?.name ?? facility.category}
            </span>
            {facility.tagline && <span>{facility.tagline}</span>}
          </p>

          {facility.is_temporarily_closed && (
            <Alert tone="warning" title="Temporarily closed" className="mt-4">
              {facility.closure_note ?? "This space isn't taking bookings right now."}
            </Alert>
          )}

          <LiveFacilityPanel facility={facility} className="mt-5" />

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            {bookable && !facility.is_temporarily_closed && (
              <ButtonLink href={`/spaces/${facility.slug}/book`} size="lg" className="sm:flex-1" icon={<CalendarPlus className="size-4.5" aria-hidden />}>
                {facility.booking_mode === "seat" ? "Choose a seat" : "Book a time slot"}
              </ButtonLink>
            )}
            <ButtonLink href={`/map?focus=${facility.slug}`} size="lg" variant="secondary" className="sm:flex-1" icon={<Map className="size-4.5" aria-hidden />}>
              View on campus map
            </ButtonLink>
          </div>
          {!bookable && <p className="mt-3 text-sm text-muted">This is a location-only listing — it can&apos;t be reserved through SPACIO.</p>}
        </div>

        <FacilityImage
          facility={facility}
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="order-1 aspect-[16/10] w-full rounded-[18px] lg:order-2 lg:aspect-[4/3.2] [&_svg]:size-14"
        />
      </div>

      {facility.booking_mode === "seat" && (
        <section aria-labelledby="layout-title" className="mt-10">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="layout-title" className="text-xl text-ink">Seat layout right now</h2>
            <LiveIndicator />
          </div>
          <LiveSeatMap facilityId={facility.id} initial={seatMap} />
        </section>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {details.amenities.length > 0 && (
            <section aria-labelledby="amenities-title">
              <h2 id="amenities-title" className="mb-3 text-xl text-ink">Facilities</h2>
              <ul className="flex flex-wrap gap-2">
                {details.amenities.map((a) => {
                  const Icon = iconFor(a.icon);
                  return (
                    <li key={a.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft">
                      <Icon className="size-4 text-forest" aria-hidden /> {a.label}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {facility.description && (
            <section aria-labelledby="about-title">
              <h2 id="about-title" className="mb-2 text-xl text-ink">About this space</h2>
              <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{facility.description}</p>
            </section>
          )}

          {facility.rules.length > 0 && (
            <section aria-labelledby="rules-title">
              <h2 id="rules-title" className="mb-2 text-xl text-ink">Rules</h2>
              <ul className="max-w-2xl list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-ink-soft marker:text-sage">
                {facility.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {bookable && (
            <section aria-labelledby="qr-title">
              <Card className="flex gap-4 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-tint text-forest">
                  <QrCode className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 id="qr-title" className="font-serif text-lg text-ink">Checking in and out</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Every booking comes with a QR pass (find it under <Link href="/pass" className="font-medium text-forest underline-offset-2 hover:underline">My pass</Link>).
                    Show it at the entrance and staff scan it to check you in, from {facility.checkin_early_minutes} minutes before your slot until {facility.no_show_grace_minutes} minutes
                    after it starts — after that the booking is released. Show it again when you leave to free your place.
                  </p>
                </div>
              </Card>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-3 font-serif text-lg text-ink">Details</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex gap-3">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <dt className="sr-only">Building</dt>
                <dd className="text-ink-soft">{facility.building?.name ?? "Building not set"}</dd>
              </div>
              <div className="flex gap-3">
                <Layers className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <dt className="sr-only">Floor</dt>
                <dd className="text-ink-soft">{facility.floor_label ?? "Floor not set"}</dd>
              </div>
              {bookable && (
                <>
                  <div className="flex gap-3">
                    <Users className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                    <dt className="sr-only">Booking type</dt>
                    <dd className="text-ink-soft">{facility.booking_mode === "seat" ? "Reserve an individual seat" : "Reserve a place (capacity-based)"}</dd>
                  </div>
                  <div className="flex gap-3">
                    <Timer className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                    <dt className="sr-only">Booking length</dt>
                    <dd className="text-ink-soft">
                      {durationLabel(facility.slot_minutes)} slots · up to {durationLabel(facility.max_booking_minutes)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-lg text-ink">
              <Clock className="size-4.5 text-muted" aria-hidden /> Opening hours
            </h2>
            {details.hours.length ? (
              <table className="w-full text-sm">
                <caption className="sr-only">Opening hours by day</caption>
                <tbody>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const h = details.hours.find((x) => x.weekday === d);
                    return (
                      <tr key={d} className={cn(d === todayIdx && "font-semibold text-ink")}>
                        <th scope="row" className="py-1 text-left font-normal text-ink-soft">
                          {WEEKDAYS[d]}
                          {d === todayIdx && <span className="sr-only"> (today)</span>}
                        </th>
                        <td className="tabular py-1 text-right text-ink-soft">
                          {!h || h.is_closed ? "Closed" : `${formatClock(h.opens_at)} – ${formatClock(h.closes_at)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">Hours haven&apos;t been set yet.</p>
            )}
          </Card>

          {hasPosition && (
            <Card className="p-4">
              <h2 className="mb-3 font-serif text-lg text-ink">Location</h2>
              <Link href={`/map?focus=${facility.slug}`} aria-label={`Open ${facility.name} on the campus map`}>
                <CampusSchematic facilities={[facility]} compact />
              </Link>
            </Card>
          )}
        </aside>
      </div>

      {facility.is_demo && <DemoNote className="mt-8" />}
    </LiveAvailabilityProvider>
  );
}
