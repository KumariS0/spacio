import type { Metadata } from "next";
import { getBuildings, getCategories, requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { FacilityForm } from "@/components/admin/facility-form";

export const metadata: Metadata = { title: "Add facility" };

export default async function NewFacilityPage() {
  await requireAdmin();
  const [categories, buildings] = await Promise.all([getCategories(), getBuildings()]);
  return (
    <div className="max-w-5xl">
      <PageHeader backHref="/admin/facilities" backLabel="Facilities" title="Add facility" description="A QR code is created automatically. You can add seats now or later." />
      <FacilityForm categories={categories} buildings={buildings} />
    </div>
  );
}
