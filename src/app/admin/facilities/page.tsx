import type { Metadata } from "next";
import Link from "next/link";
import { Armchair, Pencil, Plus, QrCode } from "lucide-react";
import { getSupabase, requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { CategoryIcon } from "@/components/spaces/facility-icon";
import type { Facility } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Facilities" };

export default async function AdminFacilities() {
  await requireAdmin();
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("facilities")
    .select("*, building:buildings(id, name, code, map_x, map_y, lat, lng), seats:facility_seats(count)")
    .order("name");
  const facilities = (data ?? []) as (Facility & { seats: { count: number }[] })[];

  return (
    <div>
      <PageHeader
        title="Facilities"
        description="Everything students can find, book and check in to. All fields are editable."
        actions={<ButtonLink href="/admin/facilities/new" icon={<Plus className="size-4.5" aria-hidden />}>Add facility</ButtonLink>}
      />
      {facilities.length === 0 ? (
        <EmptyState title="No facilities yet" action={<ButtonLink href="/admin/facilities/new">Add the first facility</ButtonLink>}>
          Add the library, gym and other spaces students should be able to find.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-paper/60 text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Facility</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Location</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Booking</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {facilities.map((f) => (
                <tr key={f.id} className="hover:bg-paper/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-tint text-forest"><CategoryIcon category={f.category} className="size-4" /></span>
                      <div>
                        <Link href={`/admin/facilities/${f.id}`} className="font-medium text-ink hover:text-forest hover:underline">{f.name}</Link>
                        <p className="text-xs text-muted">/{f.slug}{f.is_demo && " · demo data"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{[f.building?.name, f.floor_label].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {f.booking_mode === "seat" && `${f.seats?.[0]?.count ?? 0} seats`}
                    {f.booking_mode === "capacity" && `Capacity ${f.capacity}`}
                    {f.booking_mode === "none" && "Location only"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", !f.is_active ? "bg-off-tint text-ink-soft" : f.is_temporarily_closed ? "bg-moderate-tint text-moderate-ink" : "bg-ok-tint text-ok-ink")}>
                      {!f.is_active ? "Inactive" : f.is_temporarily_closed ? "Closed" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link href={`/admin/facilities/${f.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-ink-soft hover:bg-sunken hover:text-ink"><Pencil className="size-3.5" aria-hidden />Edit</Link>
                      {f.booking_mode === "seat" && (
                        <Link href={`/admin/facilities/${f.id}/seats`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-ink-soft hover:bg-sunken hover:text-ink"><Armchair className="size-3.5" aria-hidden />Seats</Link>
                      )}
                      <Link href={`/admin/qr#${f.slug}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-ink-soft hover:bg-sunken hover:text-ink"><QrCode className="size-3.5" aria-hidden />QR</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
