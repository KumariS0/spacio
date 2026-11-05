import type { Metadata } from "next";
import { getAvailability, getCategories, getFacilities, getFavoriteIds } from "@/lib/data";
import { LiveAvailabilityProvider } from "@/components/live/live-availability";
import { ExploreView, type ExploreParams } from "./explore-view";

export const metadata: Metadata = { title: "Explore spaces" };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<ExploreParams> }) {
  const params = await searchParams;
  const [facilities, availability, categories, favoriteIds] = await Promise.all([
    getFacilities(),
    getAvailability(),
    getCategories(),
    getFavoriteIds(),
  ]);
  return (
    <LiveAvailabilityProvider initial={availability}>
      <ExploreView facilities={facilities} categories={categories} favoriteIds={favoriteIds} initialParams={params} />
    </LiveAvailabilityProvider>
  );
}
