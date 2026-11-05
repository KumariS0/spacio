import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { availabilityMap, getAvailability, getFacilities, getFavoriteIds } from "@/lib/data";
import { LiveAvailabilityProvider, LiveIndicator } from "@/components/live/live-availability";
import { PageHeader } from "@/components/nav/page-header";
import { SpaceCard } from "@/components/spaces/space-card";
import { ButtonLink } from "@/components/ui/button";
import { DemoNote, EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Saved spaces" };

export default async function SavedPage() {
  const [favoriteIds, facilities] = await Promise.all([getFavoriteIds(), getFacilities()]);
  const byId = new Map(facilities.map((f) => [f.id, f]));
  const saved = favoriteIds.map((id) => byId.get(id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const availability = saved.length ? await getAvailability(saved.map((f) => f.id)) : [];
  const avail = availabilityMap(availability);

  return (
    <LiveAvailabilityProvider initial={availability} facilityIds={saved.map((f) => f.id)}>
      <PageHeader title="Saved spaces" description="Keep your go-to spaces close. See how busy they are before you head over." />
      {saved.length ? (
        <>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>
              <span className="tabular font-medium text-ink">{saved.length}</span> saved {saved.length === 1 ? "space" : "spaces"} · recently saved first
            </span>
            <LiveIndicator />
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {saved.map((f) => (
              <li key={f.id}>
                <SpaceCard facility={f} availability={avail[f.id]} isFavorite />
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-center justify-center gap-2 rounded-card bg-forest-wash px-4 py-3 text-center text-sm text-forest-deep">
            <Heart className="size-4" aria-hidden /> Found a new favourite? Tap the heart on any space to keep it here.
          </p>
          {saved.some((f) => f.is_demo) && <DemoNote className="mt-4" />}
        </>
      ) : (
        <EmptyState icon={<Heart className="size-5" aria-hidden />} title="No saved spaces yet" action={<ButtonLink href="/explore">Explore spaces</ButtonLink>}>
          Tap the heart on a space to save it here. Saved spaces stay with your account across devices.
        </EmptyState>
      )}
    </LiveAvailabilityProvider>
  );
}
