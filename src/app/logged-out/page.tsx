import type { Metadata } from "next";
import Image from "next/image";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { FooterNote } from "@/components/nav/footer-note";

export const metadata: Metadata = { title: "Signed out" };

export default async function LoggedOutPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-5 pb-8 pt-10 text-center">
      <Logo />
      <div className="relative mt-8 aspect-[4/3] w-full overflow-hidden rounded-card bg-sunken">
        <Image src="/images/campus-hero.webp" alt="" fill sizes="(max-width: 448px) 100vw, 448px" className="object-cover object-bottom" priority />
      </div>
      <div className="mt-8 grid size-12 place-items-center rounded-full bg-forest-tint text-forest">
        <Check className="size-6" aria-hidden />
      </div>
      <h1 className="mt-4 text-[30px] leading-tight text-ink">{deleted ? "Your account was deleted" : "You've been logged out"}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {deleted ? "Your bookings and saved spaces have been removed." : "Thanks for using SPACIO. See you next time!"}
      </p>
      <ButtonLink href="/login" size="lg" className="mt-8 w-full">
        Log in
      </ButtonLink>
      {!deleted && <p className="mt-4 text-sm text-muted">Your saved spaces will be here when you return.</p>}
      <FooterNote className="mt-auto pt-10" />
    </main>
  );
}
