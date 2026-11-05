import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Armchair, ExternalLink, QrCode } from "lucide-react";
import { FACILITY_SELECT, getBuildings, getCategories, getFacilityDetails, getSupabase, requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { FacilityForm } from "@/components/admin/facility-form";
import { AmenitiesEditor } from "@/components/admin/amenities-editor";
import { FacilityDangerZone } from "@/components/admin/facility-danger-zone";
import { Alert, Card } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import type { Facility } from "@/lib/types";

export const metadata: Metadata = { title: "Edit facility" };

export default async function EditFacilityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getSupabase();
  const { data } = await supabase.from("facilities").select(FACILITY_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const facility = data as Facility;
  const [categories, buildings, details] = await Promise.all([getCategories(), getBuildings(), getFacilityDetails(id)]);

  return (
    <div className="max-w-5xl">
      <PageHeader
        backHref="/admin/facilities"
        backLabel="Facilities"
        title={facility.name}
        description={`/${facility.slug}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {facility.booking_mode === "seat" && (
              <ButtonLink href={`/admin/facilities/${id}/seats`} variant="secondary" size="sm" icon={<Armchair className="size-4" aria-hidden />}>Seats</ButtonLink>
            )}
            <ButtonLink href={`/admin/qr#${facility.slug}`} variant="secondary" size="sm" icon={<QrCode className="size-4" aria-hidden />}>QR</ButtonLink>
            {facility.is_active && (
              <Link href={`/spaces/${facility.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-sm text-ink-soft hover:bg-sunken"><ExternalLink className="size-4" aria-hidden />View</Link>
            )}
          </div>
        }
      />
      {created && <Alert tone="success" className="mb-6">Facility created with its own QR code. Review the details below.</Alert>}
      <FacilityForm facility={facility} categories={categories} buildings={buildings} hours={details.hours} />
      <Card as="section" className="mt-10 p-5">
        <h2 className="font-serif text-lg text-ink">Facilities & amenities</h2>
        <p className="mb-4 text-sm text-muted">Shown as icons on the details page.</p>
        <AmenitiesEditor facilityId={id} amenities={details.amenities} />
      </Card>
      <FacilityDangerZone facilityId={id} active={facility.is_active} name={facility.name} />
    </div>
  );
}
