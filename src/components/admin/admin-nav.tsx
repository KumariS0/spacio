"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Building2, CalendarRange, Gauge, History, LayoutGrid, QrCode, ScanLine } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/scan", label: "Scan passes", icon: ScanLine },
  { href: "/admin/facilities", label: "Facilities & seats", icon: LayoutGrid },
  { href: "/admin/buildings", label: "Buildings", icon: Building2 },
  { href: "/admin/reservations", label: "Reservations", icon: CalendarRange },
  { href: "/admin/qr", label: "Entrance QR codes", icon: QrCode },
  { href: "/admin/audit", label: "Audit log", icon: History },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-sm transition-colors",
              active ? "bg-forest-tint font-semibold text-forest-deep" : "text-ink-soft hover:bg-sunken hover:text-ink",
            )}
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
          </Link>
        );
      })}
      <Link href="/home" className="mt-0 flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-sm text-muted hover:bg-sunken hover:text-ink md:mt-6">
        <ArrowLeft className="size-4.5" aria-hidden /> Back to SPACIO
      </Link>
    </nav>
  );
}
