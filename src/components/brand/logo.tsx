import { cn } from "@/lib/cn";

/** The SPACIO leaf mark, redrawn as vector from the Figma reference. */
export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      <path d="M16 29c-1.4-4.6-1.6-9.6.1-14.3C17.6 10.7 16.9 6.2 16 3c-2.9 3.1-4.6 7.3-4.3 11.6.3 4.9 2.3 9.7 4.3 14.4Z" />
      <path d="M14.6 29.2c-2.2-3.4-5.6-6-9.4-7.5C3.6 21 2.4 19.8 2 18c3.7-.6 7.6.3 10.4 2.7 1.8 1.6 2.2 4.6 2.2 8.5Z" opacity=".92" />
      <path d="M17.4 29.2c2.2-3.4 5.6-6 9.4-7.5 1.6-.7 2.8-1.9 3.2-3.7-3.7-.6-7.6.3-10.4 2.7-1.8 1.6-2.2 4.6-2.2 8.5Z" opacity=".92" />
      <path d="M13.2 23.4c-3.5-1.4-6.4-4.3-7.4-8-.4-1.6-.4-3.3.1-4.9 3 1.3 5.4 3.8 6.6 6.8.8 2 1 4.1.7 6.1Z" opacity=".8" />
      <path d="M18.8 23.4c3.5-1.4 6.4-4.3 7.4-8 .4-1.6.4-3.3-.1-4.9-3 1.3-5.4 3.8-6.6 6.8-.8 2-1 4.1-.7 6.1Z" opacity=".8" />
    </svg>
  );
}

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "text-xl gap-1.5 [&_svg]:size-6", md: "text-2xl gap-2 [&_svg]:size-7", lg: "text-4xl gap-2.5 [&_svg]:size-10" }[size];
  return (
    <span className={cn("inline-flex items-center font-serif font-semibold tracking-[0.02em] text-forest", s, className)}>
      <LeafMark />
      <span>SPACIO</span>
    </span>
  );
}
