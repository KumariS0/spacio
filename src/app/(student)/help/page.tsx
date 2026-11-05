import type { Metadata } from "next";
import { CircleHelp } from "lucide-react";
import { PageHeader } from "@/components/nav/page-header";
import { HelpTopics } from "./help-topics";

export const metadata: Metadata = { title: "Help & support" };

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader backHref="/profile" backLabel="Account" title="Help & support" />
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-forest-tint text-forest">
          <CircleHelp className="size-6" aria-hidden />
        </span>
        <h2 className="mt-3 text-2xl text-ink">A little help, right here.</h2>
        <p className="mt-1 text-sm text-muted">Questions about finding or booking a space? Start with these.</p>
      </div>
      <HelpTopics />
    </div>
  );
}
