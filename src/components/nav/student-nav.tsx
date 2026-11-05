"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, House, QrCode, User, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

const DESKTOP = [
  { href: "/home", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/map", label: "Map" },
  { href: "/saved", label: "Saved" },
  { href: "/bookings", label: "Bookings" },
];

const MOBILE = [
  { href: "/home", label: "Home", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/pass", label: "Pass", icon: QrCode, primary: true },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
];

function isActive(pathname: string, href: string) {
  if (href === "/explore") return pathname === "/explore" || pathname.startsWith("/spaces");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function DesktopNav({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-line/80 bg-paper/90 backdrop-blur-md md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/home" aria-label="SPACIO home" className="shrink-0">
          <Logo size="sm" />
        </Link>
        <nav aria-label="Main" className="flex flex-1 items-center gap-1">
          {DESKTOP.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-[15px] transition-colors duration-150",
                  active ? "font-medium text-forest" : "text-ink-soft hover:bg-sunken hover:text-ink",
                )}
              >
                {item.label}
                {active && <span aria-hidden className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-forest" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-soft hover:bg-sunken hover:text-ink">
              <ShieldCheck className="size-4" aria-hidden /> Admin
            </Link>
          )}
          <Link
            href="/pass"
            className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-forest px-3.5 text-sm font-medium text-white hover:bg-forest-deep"
          >
            <QrCode className="size-4" aria-hidden /> My pass
          </Link>
          <Link
            href="/profile"
            aria-label="Your profile"
            aria-current={isActive(pathname, "/profile") ? "page" : undefined}
            className={cn(
              "ml-1 grid size-9 place-items-center rounded-full bg-forest-tint font-serif text-sm font-semibold text-forest ring-offset-2 ring-offset-paper transition-shadow",
              isActive(pathname, "/profile") && "ring-2 ring-forest",
            )}
          >
            {initials(name) || <User className="size-4" />}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {MOBILE.map(({ href, label, icon: Icon, primary }) => {
          const active = isActive(pathname, href);
          if (primary) {
            return (
              <li key={href} className="flex justify-center">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="-mt-5 flex flex-col items-center gap-1 text-[11px] font-medium text-forest"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-forest text-white shadow-pop ring-4 ring-surface transition-transform active:scale-95">
                    <Icon className="size-5.5" aria-hidden />
                  </span>
                  {label}
                </Link>
              </li>
            );
          }
          return (
            <li key={href} className="flex justify-center">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-w-14 flex-col items-center gap-1 rounded-xl py-1 text-[11px]", active ? "font-semibold text-forest" : "text-muted")}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-200", active && "bg-forest-tint")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

