import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getFacilities, getSupabase, requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/misc";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { AdminCancelButton } from "@/components/admin/admin-cancel-button";
import { SweepButton } from "@/components/admin/sweep-button";
import { formatDateTime, formatDay, formatRange } from "@/lib/time";
import type { ReservationStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Reservations" };

const STATUSES: ReservationStatus[] = ["BOOKED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "EXPIRED", "NO_SHOW"];
const PAGE = 50;

interface Row {
  id: string;
  status: ReservationStatus;
  starts_at: string;
  ends_at: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  facility_id: string;
  facility_name: string;
  seat_label: string | null;
  student_email: string;
  student_name: string | null;
  total_count: number;
}

export default async function AdminReservations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const status = STATUSES.includes(sp.status as ReservationStatus) ? (sp.status as ReservationStatus) : "";
  const facility = /^[0-9a-f-]{36}$/i.test(sp.facility ?? "") ? sp.facility! : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await getSupabase();
  const [facilities, { data, error }] = await Promise.all([
    getFacilities(),
    supabase.rpc("admin_list_reservations", {
      p_search: q || null,
      p_status: status || null,
      p_facility_id: facility || null,
      p_limit: PAGE,
      p_offset: (page - 1) * PAGE,
    }),
  ]);
  const rows = (data ?? []) as Row[];
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const merged = { q, status, facility, page, ...p };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === 1)) params.set(k, String(v));
    const s = params.toString();
    return `/admin/reservations${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Reservations" description="Search every booking, cancel when needed, and review no-shows." actions={<SweepButton />} />

      <form method="get" className="mb-4 grid gap-2 rounded-card border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
        <label htmlFor="r-q" className="sr-only">Search</label>
        <Input id="r-q" name="q" defaultValue={q} placeholder="Email, name, facility, seat or booking ID" icon={<Search className="size-4" aria-hidden />} className="h-10" />
        <label htmlFor="r-status" className="sr-only">Status</label>
        <Select id="r-status" name="status" defaultValue={status} className="h-10">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
        <label htmlFor="r-facility" className="sr-only">Facility</label>
        <Select id="r-facility" name="facility" defaultValue={facility} className="h-10">
          <option value="">All facilities</option>
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
        <Button type="submit" variant="secondary" className="h-10">Filter</Button>
      </form>

      <nav aria-label="Quick filters" className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          { label: "All", s: "" },
          { label: "Checked in now", s: "CHECKED_IN" },
          { label: "Upcoming", s: "BOOKED" },
          { label: "No-shows", s: "NO_SHOW" },
        ].map((c) => (
          <Link
            key={c.label}
            href={link({ status: c.s, page: 1 })}
            aria-current={status === c.s ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1", status === c.s ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-soft hover:border-line-strong")}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <Alert tone="error">Couldn’t load reservations. {error.message}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState title="No reservations match">Try a different search or status.</EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted tabular">{total} reservation{total === 1 ? "" : "s"}</p>
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-paper/60 text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Student</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Facility</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Time</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Activity</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{r.student_name || "—"}</p>
                      <p className="text-xs text-muted">{r.student_email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {r.facility_name}
                      {r.seat_label && <span className="text-muted"> · Seat {r.seat_label}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft tabular">{formatDay(r.starts_at)} · {formatRange(r.starts_at, r.ends_at)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {r.checked_in_at && <p>In {formatDateTime(r.checked_in_at)}</p>}
                      {r.checked_out_at && <p>Out {formatDateTime(r.checked_out_at)}</p>}
                      {r.cancelled_at && <p>Cancelled {formatDateTime(r.cancelled_at)}{r.cancel_reason && ` — ${r.cancel_reason}`}</p>}
                      {!r.checked_in_at && !r.cancelled_at && <p>Booked {formatDateTime(r.created_at)}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(r.status === "BOOKED" || r.status === "CHECKED_IN") && <AdminCancelButton id={r.id} label={`${r.student_email} at ${r.facility_name}`} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
              {page > 1 ? <Link href={link({ page: page - 1 })} className="rounded-lg px-3 py-1.5 hover:bg-sunken">← Previous</Link> : <span />}
              <span className="text-muted tabular">Page {page} of {pages}</span>
              {page < pages ? <Link href={link({ page: page + 1 })} className="rounded-lg px-3 py-1.5 hover:bg-sunken">Next →</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
