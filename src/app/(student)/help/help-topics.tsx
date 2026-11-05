"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const TOPICS = [
  {
    q: "How do I book a library seat?",
    a: "Open Explore, choose the library, then tap “Choose a seat”. Pick a day, a start time and a duration, tap a green seat, and press Reserve. The server double-checks that the seat is still free before confirming.",
  },
  {
    q: "How do I check in?",
    a: "Every booking has its own QR pass. Open My pass (or the booking itself) when you arrive and show it at the entrance. Staff scan it and check you in, as long as you're inside the booking's check-in window.",
  },
  {
    q: "How do I check out?",
    a: "Show the same pass when you leave. Staff scan it to check you out, which releases your seat or place immediately so another student can book it. If you forget, the session ends automatically at your booking's end time.",
  },
  {
    q: "What happens if I'm late?",
    a: "Each space has a short grace period after your start time. If you haven't checked in by then, the booking is marked as a no-show and the place is released.",
  },
  {
    q: "Why can't I book two things at once?",
    a: "You can't hold overlapping bookings, and there's a limit on how many upcoming bookings you can have, so spaces stay fair for everyone. Cancel one to free up a slot.",
  },
  {
    q: "My pass won't scan",
    a: "Turn your screen brightness up and hold the phone steady. If it still won't scan, open “Can’t be scanned?” under the pass and let staff type the code shown there.",
  },
  {
    q: "Is SPACIO an official SRM service?",
    a: "No. SPACIO is a student project. Facility details shown as demo data aren't verified SRM information.",
  },
  {
    q: "Who can see my bookings?",
    a: "Only you and SPACIO administrators. Other students only see whether a seat is free, reserved or occupied — never who booked it.",
  },
];

export function HelpTopics() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(0);
  const n = q.trim().toLowerCase();
  const list = TOPICS.map((t, i) => ({ ...t, i })).filter((t) => !n || `${t.q} ${t.a}`.toLowerCase().includes(n));

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="help-search" className="sr-only">Search help</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
        <input id="help-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for help" className={cn(inputClass, "pl-10")} />
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {list.map((t) => {
          const isOpen = open === t.i || Boolean(n);
          return (
            <li key={t.i}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`help-${t.i}`}
                onClick={() => setOpen(open === t.i ? null : t.i)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-ink hover:bg-paper/70"
              >
                <span className="flex-1">{t.q}</span>
                <ChevronDown className={cn("size-4 text-muted transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
              </button>
              {isOpen && (
                <p id={`help-${t.i}`} className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">
                  {t.a}
                </p>
              )}
            </li>
          );
        })}
        {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No help topics match “{q}”.</li>}
      </ul>
    </div>
  );
}
