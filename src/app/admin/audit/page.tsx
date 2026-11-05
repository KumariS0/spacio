import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase, requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { Alert, EmptyState } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 50;
const ENTITIES = ["facilities", "facility_seats", "buildings", "facility_qr_codes", "reservations", "profile", "allowed_email_domains", "facility_operating_hours", "facility_amenities", "facility_categories", "app_settings"];
const ENTITY_LABEL: Record<string, string> = {
  facilities: "Facility",
  facility_seats: "Seat",
  buildings: "Building",
  facility_qr_codes: "QR code",
  reservations: "Reservation",
  profile: "User role",
  allowed_email_domains: "Email domain",
  facility_operating_hours: "Hours",
  facility_amenities: "Amenity",
  facility_categories: "Category",
  app_settings: "Settings",
};
const HIDDEN_KEYS = new Set(["updated_at", "created_at", "token"]);

interface LogRow {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
  actor: { email: string; full_name: string | null } | null;
}

function show(v: unknown) {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function changes(row: LogRow) {
  const b = row.before ?? {};
  const a = row.after ?? {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !HIDDEN_KEYS.has(k));
  if (row.before && row.after) return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k])).map((k) => ({ k, from: show(b[k]), to: show(a[k]) }));
  const src = row.after ?? row.before ?? {};
  return ["name", "label", "status", "domain", "role", "facility_id"].filter((k) => k in src).map((k) => ({ k, from: null, to: show(src[k]) }));
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const entity = ENTITIES.includes(sp.entity ?? "") ? sp.entity! : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const supabase = await getSupabase();
  let query = supabase
    .from("admin_audit_logs")
    .select("id, action, entity_type, entity_id, before, after, created_at, actor:profiles(email, full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (entity) query = query.eq("entity_type", entity);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as LogRow[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: { entity?: string; page?: number }) => {
    const params = new URLSearchParams();
    const e = p.entity ?? entity;
    const pg = p.page ?? page;
    if (e) params.set("entity", e);
    if (pg > 1) params.set("page", String(pg));
    const s = params.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Audit log" description="Every change to facilities, seats, QR codes, user roles and staff cancellations — recorded by the database, so it can’t be skipped from the website." />
      <nav aria-label="Filter by type" className="mb-4 flex flex-wrap gap-2 text-sm">
        {["", ...ENTITIES].map((e) => (
          <Link
            key={e || "all"}
            href={href({ entity: e, page: 1 })}
            aria-current={entity === e ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1", entity === e ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-soft hover:border-line-strong")}
          >
            {e ? ENTITY_LABEL[e] : "All"}
          </Link>
        ))}
      </nav>
      {error ? (
        <Alert tone="error">Couldn’t load the audit log. {error.message}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing recorded yet">Changes made by admins appear here.</EmptyState>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map((r) => {
            const diff = changes(r);
            return (
              <li key={r.id} className="grid gap-1 p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <div className="text-xs text-muted">
                  <time dateTime={r.created_at} className="tabular">{formatDateTime(r.created_at)}</time>
                  <p className="mt-0.5 truncate">{r.actor?.full_name || r.actor?.email || "System"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{ENTITY_LABEL[r.entity_type] ?? r.entity_type}</span>{" "}
                    <span className="text-ink-soft">{r.action.toLowerCase().replace(/_/g, " ")}</span>
                    {r.entity_id && <span className="ml-2 font-mono text-[11px] text-muted">{r.entity_id.slice(0, 8)}</span>}
                  </p>
                  {diff.length > 0 && (
                    <dl className="mt-1.5 space-y-0.5 text-xs">
                      {diff.slice(0, 8).map((d) => (
                        <div key={d.k} className="flex gap-2">
                          <dt className="shrink-0 font-mono text-muted">{d.k}</dt>
                          <dd className="min-w-0 truncate text-ink-soft">
                            {d.from != null && <><span className="line-through decoration-busy/60">{d.from}</span> → </>}
                            {d.to}
                          </dd>
                        </div>
                      ))}
                      {diff.length > 8 && <p className="text-muted">+{diff.length - 8} more fields</p>}
                    </dl>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: page - 1 })} className="rounded-lg px-3 py-1.5 hover:bg-sunken">← Newer</Link> : <span />}
          <span className="text-muted tabular">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: page + 1 })} className="rounded-lg px-3 py-1.5 hover:bg-sunken">Older →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
