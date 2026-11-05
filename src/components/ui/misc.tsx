import type { ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert, CircleX } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, children, as: Tag = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" | "li" }) {
  return <Tag className={cn("rounded-card border border-line bg-surface shadow-card", className)}>{children}</Tag>;
}

type Tone = "info" | "success" | "warning" | "error";
const toneStyles: Record<Tone, string> = {
  info: "border-forest/20 bg-forest-wash text-forest-deep",
  success: "border-ok/25 bg-ok-tint text-ok-ink",
  warning: "border-moderate/30 bg-moderate-tint text-moderate-ink",
  error: "border-busy/25 bg-busy-tint text-busy-ink",
};
const toneIcon: Record<Tone, typeof Info> = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleX };

export function Alert({ tone = "info", title, children, className, action }: { tone?: Tone; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  const Icon = toneIcon[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-card border p-3.5 text-sm", toneStyles[tone], className)}>
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
        {action && <div className="pt-1.5">{action}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-sunken", className)} />;
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-card border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full bg-forest-tint text-forest">{icon}</div>}
      <h3 className="text-lg text-ink">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}>{children}</span>;
}

export function DemoNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-center text-xs text-muted", className)}>
      <Info className="size-3.5" aria-hidden />
      Demo data — not verified SRM infrastructure
    </p>
  );
}

export function SectionHeader({ title, action, className, id }: { title: string; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <h2 id={id} className="text-xl text-ink">{title}</h2>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-4", className)}>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="tabular mt-1 font-serif text-[28px] leading-none text-ink">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}
