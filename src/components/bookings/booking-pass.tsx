import { bookingPassSvg } from "@/lib/qr-codes";
import { formatDay, formatRange, formatTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { Reservation } from "@/lib/types";

/**
 * The booking's QR pass. The student shows it at the entrance and an admin
 * scans it to check them in and, later, out. Server-rendered; the QR holds a
 * link with the booking's random pass token and nothing else.
 */
export async function BookingPass({ reservation: r, className }: { reservation: Reservation; className?: string }) {
  if (!r.pass_token || (r.status !== "BOOKED" && r.status !== "CHECKED_IN")) return null;
  const { svg } = await bookingPassSvg(r.pass_token);

  const early = r.facility?.checkin_early_minutes ?? 15;
  const grace = r.facility?.no_show_grace_minutes ?? 15;
  const opens = new Date(new Date(r.starts_at).getTime() - early * 60_000);
  const deadline = new Date(Math.max(new Date(r.starts_at).getTime(), new Date(r.created_at).getTime()) + grace * 60_000);
  const checkedIn = r.status === "CHECKED_IN";

  return (
    <section id="pass" aria-labelledby="pass-title" className={cn("@container scroll-mt-24 overflow-hidden rounded-card border border-line bg-surface shadow-card", className)}>
      <div className={cn("px-5 py-3 text-white", checkedIn ? "bg-ok-ink" : "bg-forest")}>
        <h2 id="pass-title" className="font-serif text-lg leading-tight">{checkedIn ? "Checked in · show to check out" : "Your booking pass"}</h2>
      </div>
      <div className="flex flex-col items-center gap-4 p-5 @[540px]:flex-row @[540px]:items-start @[540px]:gap-6">
        <div
          className="aspect-square w-full max-w-[240px] shrink-0 rounded-[14px] border border-line bg-white p-2 [&>svg]:size-full"
          role="img"
          aria-label={`QR pass for ${r.facility?.name ?? "this booking"}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="w-full min-w-0 text-center @[540px]:text-left">
          <p className="font-serif text-xl leading-snug text-ink">{r.facility?.name}</p>
          <p className="mt-0.5 text-[15px] text-ink-soft">
            {formatDay(r.starts_at)}, <span className="whitespace-nowrap">{formatRange(r.starts_at, r.ends_at)}</span>
            {r.seat?.label ? ` · Seat ${r.seat.label}` : ""}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {checkedIn
              ? "Show this pass again when you leave. Staff scan it to check you out and free your place."
              : `Show this pass at the entrance. Staff scan it to check you in between ${formatTime(opens)} and ${formatTime(deadline)}; after that the booking is released as a no-show.`}
          </p>
          <p className="mt-3 text-xs text-muted">Tip: turn your screen brightness up. Don’t share this pass; it’s linked to your account.</p>
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer select-none hover:text-ink">Can’t be scanned?</summary>
            <p className="mt-1.5">Staff can type this code instead:</p>
            <p className="mt-1 select-all break-all rounded-md bg-sunken px-2 py-1.5 font-mono text-[12px] text-ink">{r.pass_token}</p>
          </details>
        </div>
      </div>
    </section>
  );
}
