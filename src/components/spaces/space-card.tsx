"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { locationLine } from "@/lib/location";
import type { Availability, Facility } from "@/lib/types";
import { useAvailability } from "@/components/live/live-availability";
import { CategoryIcon } from "./facility-icon";
import { FavoriteButton } from "./favorite-button";
import { OccupancyMeter, OpenStatus } from "./occupancy";

export function FacilityImage({ facility, className, sizes, priority }: { facility: Pick<Facility, "image_url" | "name" | "category">; className?: string; sizes?: string; priority?: boolean }) {
  if (facility.image_url) {
    return (
      <div className={cn("relative overflow-hidden bg-sunken", className)}>
        <Image src={facility.image_url} alt="" fill sizes={sizes ?? "160px"} className="object-cover" priority={priority} />
      </div>
    );
  }
  // No photo yet: a calm category placeholder instead of a fake image.
  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-forest-tint text-forest", className)}>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.09]"
        style={{ backgroundImage: "radial-gradient(currentColor 1.3px, transparent 1.4px)", backgroundSize: "14px 14px" }}
      />
      <CategoryIcon category={facility.category} className="relative size-8" />
    </div>
  );
}

/** Horizontal card used in lists (Home, Explore, Saved, Map list). */
export function SpaceCard({
  facility,
  availability: initial,
  isFavorite,
  priority,
  className,
}: {
  facility: Facility;
  availability?: Availability;
  isFavorite: boolean;
  /** Load the photo eagerly — set on the first cards of a page (largest paint). */
  priority?: boolean;
  className?: string;
}) {
  const availability = useAvailability(facility.id, initial);
  return (
    <article className={cn("@container group relative flex gap-3.5 rounded-card border border-line bg-surface p-2.5 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-pop sm:p-3", className)}>
      <FacilityImage facility={facility} priority={priority} className="h-auto min-h-28 w-24 shrink-0 self-stretch rounded-[10px] @[420px]:w-36" />
      <div className="flex min-w-0 flex-1 flex-col py-0.5 pr-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-serif text-lg leading-tight text-ink">
            <Link href={`/spaces/${facility.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-forest">
              {facility.name}
            </Link>
          </h3>
          <FavoriteButton facilityId={facility.id} facilityName={facility.name} isFavorite={isFavorite} className="-mr-1.5 -mt-1.5 size-9" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <OpenStatus availability={availability} closed={facility.is_temporarily_closed} />
          <span className="flex min-w-0 items-center gap-1 text-[13px] text-muted">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{locationLine(facility)}</span>
          </span>
        </div>
        <OccupancyMeter availability={availability} compact className="mt-auto pt-2.5" />
        <div className="mt-2 flex items-center justify-between gap-2 text-[13px]">
          <span className="truncate text-muted">
            {availability?.booking_mode === "seat" && availability.available != null && `${availability.available} seats free`}
            {availability?.booking_mode === "capacity" && availability.available != null && `${availability.available} places free`}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap font-medium text-forest">
            View details <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}
