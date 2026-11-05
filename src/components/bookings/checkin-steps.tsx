import { QrCode, ScanLine, DoorOpen } from "lucide-react";
import { formatTime } from "@/lib/time";
import type { Reservation } from "@/lib/types";

/** What to do next, depending on the reservation state. */
export function CheckinSteps({ reservation: r }: { reservation: Reservation }) {
  const early = r.facility?.checkin_early_minutes ?? 15;
  const grace = r.facility?.no_show_grace_minutes ?? 15;
  const opens = new Date(new Date(r.starts_at).getTime() - early * 60_000);
  const deadline = new Date(Math.max(new Date(r.starts_at).getTime(), new Date(r.created_at).getTime()) + grace * 60_000);

  const steps =
    r.status === "CHECKED_IN"
      ? [
          { icon: DoorOpen, title: "You're checked in", body: "Enjoy your session. Your place is held until the end of your booking." },
          { icon: ScanLine, title: "Leaving? Show your pass", body: "Staff scan the same pass to check you out, which releases your place for others straight away." },
        ]
      : [
          { icon: QrCode, title: "Open your pass", body: "It's at the top of this booking, and on Home under your next booking." },
          {
            icon: ScanLine,
            title: "Show it at the entrance",
            body: `Staff at ${r.facility?.name ?? "the space"} scan it between ${formatTime(opens)} and ${formatTime(deadline)}. After that, the booking is released as a no-show.`,
          },
          { icon: DoorOpen, title: "Show it again when you leave", body: "The same pass checks you out and frees your place straight away." },
        ];

  return (
    <ol className="space-y-4">
      {steps.map(({ icon: Icon, title, body }, i) => (
        <li key={title} className="flex gap-3.5">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-forest-tint text-forest">
            <Icon className="size-4.5" aria-hidden />
            <span className="sr-only">Step {i + 1}</span>
          </span>
          <div>
            <p className="font-medium text-ink">{title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
