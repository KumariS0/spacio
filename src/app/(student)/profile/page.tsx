import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarDays, ChevronRight, CircleHelp, Heart, History, Pencil, ShieldCheck } from "lucide-react";
import { getFacilities, getFavoriteIds, getMyReservations, requireStudent } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { Card, Stat } from "@/components/ui/misc";
import { CategoryIcon } from "@/components/spaces/facility-icon";
import { LogoutButton, DeleteAccountButton } from "@/components/auth/account-actions";

export const metadata: Metadata = { title: "Profile" };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default async function ProfilePage() {
  const viewer = await requireStudent();
  const [reservations, favoriteIds, facilities] = await Promise.all([getMyReservations({ limit: 500 }), getFavoriteIds(), getFacilities()]);
  const p = viewer.profile;
  const visited = reservations.filter((r) => r.checked_in_at);
  const upcoming = reservations.filter((r) => r.status === "BOOKED" && new Date(r.ends_at) > new Date()).length;

  const freq = new Map<string, { name: string; slug: string; category: string; count: number }>();
  for (const r of visited) {
    if (!r.facility) continue;
    const cur = freq.get(r.facility.id) ?? { name: r.facility.name, slug: r.facility.slug, category: r.facility.category, count: 0 };
    cur.count++;
    freq.set(r.facility.id, cur);
  }
  const top = [...freq.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  const saved = favoriteIds.map((id) => facilities.find((f) => f.id === id)).filter(Boolean).slice(0, 4);

  const menu = [
    { href: "/profile/edit", label: "Edit profile", icon: Pencil },
    { href: "/saved", label: "Saved spaces", icon: Heart, meta: `${favoriteIds.length}` },
    { href: "/bookings", label: "My bookings", icon: CalendarDays, meta: upcoming ? `${upcoming} upcoming` : undefined },
    { href: "/bookings/history", label: "Booking history", icon: History },
    { href: "/help", label: "Help & support", icon: CircleHelp },
    ...(viewer.isAdmin ? [{ href: "/admin", label: "Admin dashboard", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account" />
      <Card className="flex items-center gap-4 bg-forest-wash p-4 sm:p-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-forest font-serif text-xl text-white">{initials(p.full_name ?? p.email)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-xl text-ink">{p.full_name}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-ink-soft">
            {p.email}
            <BadgeCheck className="size-4 shrink-0 text-ok" aria-label="Verified college email" />
          </p>
          {p.register_number && <p className="mt-0.5 text-xs text-muted">Reg. no. {p.register_number}</p>}
        </div>
        {viewer.isAdmin && <span className="rounded-full bg-forest px-2.5 py-1 text-xs font-semibold text-white">Admin</span>}
      </Card>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Reservations" value={reservations.length} />
        <Stat label="Visits" value={visited.length} />
        <Stat label="Saved" value={favoriteIds.length} />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Card as="section" className="p-4">
          <h2 className="mb-3 font-serif text-lg text-ink">Frequently visited</h2>
          {top.length ? (
            <ul className="space-y-2">
              {top.map((f) => (
                <li key={f.slug}>
                  <Link href={`/spaces/${f.slug}`} className="flex items-center gap-3 rounded-[10px] p-1.5 hover:bg-paper">
                    <span className="grid size-8 place-items-center rounded-full bg-forest-tint text-forest"><CategoryIcon category={f.category} className="size-4" /></span>
                    <span className="flex-1 text-sm text-ink">{f.name}</span>
                    <span className="tabular text-xs text-muted">{f.count} visit{f.count > 1 ? "s" : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Check in to a space and it&apos;ll show up here.</p>
          )}
        </Card>
        <Card as="section" className="p-4">
          <h2 className="mb-3 font-serif text-lg text-ink">Saved spaces</h2>
          {saved.length ? (
            <ul className="space-y-2">
              {saved.map((f) => (
                <li key={f!.id}>
                  <Link href={`/spaces/${f!.slug}`} className="flex items-center gap-3 rounded-[10px] p-1.5 hover:bg-paper">
                    <span className="grid size-8 place-items-center rounded-full bg-forest-tint text-forest"><CategoryIcon category={f!.category} className="size-4" /></span>
                    <span className="flex-1 text-sm text-ink">{f!.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Tap the heart on a space to save it.</p>
          )}
        </Card>
      </div>

      <nav aria-label="Account" className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        <ul className="divide-y divide-line">
          {menu.map(({ href, label, icon: Icon, meta }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3 px-4 py-3.5 text-[15px] text-ink hover:bg-paper/70">
                <Icon className="size-4.5 text-ink-soft" aria-hidden />
                <span className="flex-1">{label}</span>
                {meta && <span className="text-sm text-muted">{meta}</span>}
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
        <DeleteAccountButton />
        <div className="border-t border-line" />
        <LogoutButton />
      </div>
      <p className="mt-6 text-center text-xs text-muted">SPACIO 1.0 · A little more room for campus life</p>
    </div>
  );
}
