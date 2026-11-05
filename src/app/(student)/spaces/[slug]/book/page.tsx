import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getFacilityBySlug, getSupabase } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { BookingFlow } from "@/components/booking/booking-flow";
import { DemoNote } from "@/components/ui/misc";
import { locationLine } from "@/lib/location";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = await getFacilityBySlug((await params).slug);
  return { title: f ? `Book · ${f.name}` : "Book" };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const facility = await getFacilityBySlug(slug);
  if (!facility || !facility.is_active) notFound();
  if (facility.booking_mode === "none" || facility.is_temporarily_closed) redirect(`/spaces/${slug}`);

  const supabase = await getSupabase();
  const { data: settings } = await supabase.from("app_settings").select("booking_horizon_days").maybeSingle();

  return (
    <div>
      <PageHeader
        backHref={`/spaces/${slug}`}
        backLabel={facility.name}
        title={facility.booking_mode === "seat" ? "Choose a seat" : "Book a time slot"}
        description={`${facility.name} · ${locationLine(facility)}`}
      />
      <BookingFlow
        facility={{
          id: facility.id,
          slug: facility.slug,
          name: facility.name,
          booking_mode: facility.booking_mode,
          slot_minutes: facility.slot_minutes,
          max_booking_minutes: facility.max_booking_minutes,
          no_show_grace_minutes: facility.no_show_grace_minutes,
        }}
        horizonDays={Math.min(settings?.booking_horizon_days ?? 7, 14)}
      />
      {facility.is_demo && <DemoNote className="mt-8" />}
    </div>
  );
}
