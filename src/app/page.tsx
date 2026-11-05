import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LogIn, LogOut, TimerOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { FooterNote } from "@/components/nav/footer-note";
import { publicEnv } from "@/lib/env";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { isGuestAssistantEnabled } from "@/lib/assistant/config";

/** One booking, start to finish. The times are part of the explanation. */
const JOURNEY = [
  { time: "9:40 am", title: "Reserve seat B05", body: "The library shows 16 seats free. You pick B05 for 10 am – 12 pm. Nobody else can take it now." },
  { time: "10:02 am", title: "Show your pass at the door", body: "Your booking comes with its own QR pass. Check-in opens 15 minutes before your slot; staff scan the pass and the seat shows as occupied." },
  { time: "11:58 am", title: "Show it again when you leave", body: "One more scan of the same pass checks you out. B05 is free for the next student straight away." },
  { time: "10:15 am", title: "…or don’t show up", body: "If you’re not checked in, the seat is released 15 minutes after the start, so empty seats don’t stay blocked." },
];

/** Fictional names. Illustrates the admin check-in log; not real activity. */
const EXAMPLE_LOG = [
  { name: "Ananya R.", kind: "in", place: "Computer Lab", detail: "Station 14", time: "10:14 am" },
  { name: "Rohan D.", kind: "in", place: "Reading Room", detail: "Seat A05", time: "10:09 am" },
  { name: "Aarav S.", kind: "in", place: "Central Library", detail: "Seat B05", time: "10:02 am" },
  { name: "Meera I.", kind: "out", place: "Fitness Centre", detail: "Morning session", time: "9:56 am" },
  { name: "Kabir S.", kind: "out", place: "Central Library", detail: "Seat B04", time: "9:47 am" },
  { name: "Sara T.", kind: "auto", place: "Reading Room", detail: "Seat B02 · session ended automatically", time: "9:30 am" },
] as const;

const LOG_KIND = {
  in: { verb: "checked in at", icon: LogIn, tone: "bg-ok-tint text-ok" },
  out: { verb: "checked out of", icon: LogOut, tone: "bg-sunken text-ink-soft" },
  auto: { verb: "left without checking out of", icon: TimerOff, tone: "bg-moderate-tint text-moderate" },
} as const;

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8 md:h-20">
        <Logo />
        <Link href="/login" className="rounded-lg px-3 py-2 text-[15px] font-medium text-forest hover:bg-forest-wash">
          Log in
        </Link>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pb-10 pt-4 sm:px-8 md:grid-cols-[1.05fr_1fr] md:gap-4 md:pb-16 md:pt-10">
          <div className="relative z-10 max-w-xl animate-rise">
            <h1 className="text-[40px] leading-[1.05] text-ink sm:text-[52px] lg:text-[60px]">Find your space on campus.</h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft">
              A quiet corner. A place to move. Check live availability for the library, gym and study spaces, reserve a spot, and check in with
              your booking’s QR pass.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/login" size="lg" className="sm:px-7">
                Sign in with college email <ArrowRight className="size-4.5" aria-hidden />
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary" size="lg">
                How it works
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-muted">For students at {publicEnv.campusShortName}. No password: we email you a one-time code.</p>
          </div>

          <div className="relative -mx-5 aspect-[5/4] sm:mx-0 md:aspect-[4/5] md:max-h-[560px]">
            <div className="absolute inset-0 overflow-hidden rounded-none sm:rounded-[28px] md:rounded-[36px_36px_36px_140px]">
              <Image
                src="/images/campus-hero.webp"
                alt="Illustration of a campus building with a tree-lined path"
                fill
                priority
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover object-[60%_bottom]"
              />
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-6 border-t border-line bg-surface/60">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 md:py-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
            <div>
              <h2 id="how-title" className="text-[30px] leading-tight text-ink sm:text-[34px]">One pass, in and out</h2>
              <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-soft">
                Every booking comes with its own QR pass. Show it when you arrive and again when you leave. It holds no personal details, just a code SPACIO matches to your booking.
              </p>
              <ol className="mt-10 space-y-0">
                {JOURNEY.map((step, i) => (
                  <li key={step.title} className="relative grid grid-cols-[4.5rem_1fr] gap-x-4 pb-8 last:pb-0 sm:grid-cols-[6.5rem_1fr] sm:gap-x-5">
                    <time className="pt-0.5 text-right text-sm font-medium tabular text-forest">{step.time}</time>
                    <div className={i === JOURNEY.length - 1 ? "relative border-l border-transparent pl-5 sm:pl-6" : "relative border-l border-line pl-5 sm:pl-6"}>
                      <span
                        aria-hidden
                        className={i === JOURNEY.length - 1 ? "absolute -left-[5px] top-1.5 size-[9px] rounded-full border border-line-strong bg-paper" : "absolute -left-[5px] top-1.5 size-[9px] rounded-full bg-forest"}
                      />
                      <h3 className={i === JOURNEY.length - 1 ? "text-lg leading-snug text-ink-soft" : "text-lg leading-snug text-ink"}>{step.title}</h3>
                      <p className="mt-1 max-w-[52ch] text-[15px] leading-relaxed text-muted">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <figure className="self-start lg:mt-2">
              <div className="overflow-hidden rounded-card border border-line bg-surface shadow-pop">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <p className="font-serif text-[17px] text-ink">Check-in log</p>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <span aria-hidden className="size-1.5 rounded-full bg-ok" /> Live for staff
                  </span>
                </div>
                <ol className="divide-y divide-line" aria-label="Example check-in log with fictional students">
                  {EXAMPLE_LOG.map((e) => {
                    const k = LOG_KIND[e.kind];
                    const Icon = k.icon;
                    return (
                      <li key={e.name + e.time} className="flex items-start gap-3 px-4 py-3">
                        <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${k.tone}`} aria-hidden>
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-ink">
                            <span className="font-medium">{e.name}</span> <span className="text-ink-soft">{k.verb}</span> <span className="font-medium text-forest">{e.place}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted">{e.detail}</p>
                        </div>
                        <time className="shrink-0 pt-0.5 text-xs tabular text-muted">{e.time}</time>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <figcaption className="mt-3 text-xs leading-relaxed text-muted">
                Example with fictional students. Admins see the real log; students only ever see their own bookings.
              </figcaption>
            </figure>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <FooterNote />
      </footer>
      {/* Guest mode: general questions only, until the visitor signs in. */}
      {isGuestAssistantEnabled() && <AssistantWidget configured mode="guest" placement="corner" />}
    </div>
  );
}
