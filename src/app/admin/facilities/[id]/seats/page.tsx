import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabase, requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { SeatEditor } from "@/components/admin/seat-editor";
import { Alert } from "@/components/ui/misc";
import type { Seat, SeatMapRow } from "@/lib/types";

export const metadata: Metadata = { title: "Seats" };

export default async function SeatsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getSupabase();
  const { data: facility } = await supabase.from("facilities").select("id, name, booking_mode").eq("id", id).maybeSingle();
  if (!facility) notFound();

  const now = new Date();
  const [{ data: seats }, { data: live }] = await Promise.all([
    supabase.from("facility_seats").select("*").eq("facility_id", id).order("row_label").order("col_index"),
    supabase.rpc("get_seat_map", { p_facility_id: id, p_from: now.toISOString(), p_to: new Date(now.getTime() + 60_000).toISOString() }),
  ]);
  const liveState = Object.fromEntries(((live ?? []) as SeatMapRow[]).map((s) => [s.seat_id, s.state]));

  return (
    <div className="max-w-5xl">
      <PageHeader backHref={`/admin/facilities/${id}`} backLabel={facility.name} title="Seats" description="Select seats to change their status or remove them. Live states show who is booked or checked in right now." />
      {facility.booking_mode !== "seat" && (
        <Alert tone="warning" className="mb-6">This facility isn’t seat-based, so students can’t pick these seats. Change the reservation type on the facility page to use them.</Alert>
      )}
      <SeatEditor facilityId={id} seats={(seats ?? []) as Seat[]} liveState={liveState} />
    </div>
  );
}
