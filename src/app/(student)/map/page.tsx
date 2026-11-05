import type { Metadata } from "next";
import { getAvailability, getFacilities, getFavoriteIds } from "@/lib/data";
import { LiveAvailabilityProvider } from "@/components/live/live-availability";
import { MapView } from "@/components/map/map-view";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Campus map" };

export default async function MapPage({ searchParams }: { searchParams: Promise<{ focus?: string; view?: string }> }) {
  const { focus, view } = await searchParams;
  const [facilities, availability, favoriteIds] = await Promise.all([getFacilities(), getAvailability(), getFavoriteIds()]);
  const focusId = facilities.find((f) => f.slug === focus)?.id ?? null;
  return (
    <LiveAvailabilityProvider initial={availability}>
      <MapView
        facilities={facilities}
        favoriteIds={favoriteIds}
        initialFocusId={focusId}
        initialView={view === "list" ? "list" : "map"}
        mapCenter={publicEnv.mapCenter}
      />
    </LiveAvailabilityProvider>
  );
}
