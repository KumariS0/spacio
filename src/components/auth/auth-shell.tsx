import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { FooterNote } from "@/components/nav/footer-note";

/** Split layout from the desktop mockups: campus illustration + form card. */
export function AuthShell({ children, illustration = "/images/campus-library-illustration.webp" }: { children: ReactNode; illustration?: string }) {
  return (
    <div className="relative flex min-h-dvh flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-sunken md:block">
        <Image src={illustration} alt="" fill priority sizes="50vw" className="object-cover object-bottom" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-paper via-paper/70 to-transparent" />
        <Link href="/" className="absolute left-10 top-9" aria-label="SPACIO home">
          <Logo />
        </Link>
      </aside>
      <div className="flex flex-1 flex-col px-5 pb-8 pt-8 sm:px-8 md:justify-center md:px-12 lg:px-20">
        <Link href="/" className="mb-10 self-center md:hidden" aria-label="SPACIO home">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-[420px] animate-rise">{children}</div>
        <FooterNote className="mx-auto mt-auto max-w-xs pt-10 md:mt-12" />
      </div>
    </div>
  );
}
