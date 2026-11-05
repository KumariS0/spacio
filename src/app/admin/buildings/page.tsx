import type { Metadata } from "next";
import { getBuildings, getSupabase, requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { BuildingManager } from "@/components/admin/building-manager";

export const metadata: Metadata = { title: "Buildings" };

export default async function BuildingsPage() {
  await requireAdmin();
  const supabase = await getSupabase();
  const [buildings, { data: facilities }] = await Promise.all([getBuildings(), supabase.from("facilities").select("building_id")]);
  const counts: Record<string, number> = {};
  for (const f of facilities ?? []) if (f.building_id) counts[f.building_id] = (counts[f.building_id] ?? 0) + 1;
  return (
    <div className="max-w-5xl">
      <PageHeader title="Buildings" description="Buildings group facilities and place them on the schematic campus map. Only add latitude and longitude you have verified." />
      <BuildingManager buildings={buildings} facilityCounts={counts} />
    </div>
  );
}
