import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/cn";

export function FooterNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-xs leading-relaxed text-muted", className)}>
      SPACIO is a student project for {publicEnv.campusShortName} students — not an official SRM service.
    </p>
  );
}
