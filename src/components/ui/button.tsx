import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[var(--ease-out)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary: "bg-forest text-white shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_1px_2px_rgb(22_63_48/0.3)] hover:bg-forest-deep",
  secondary: "border border-forest/35 bg-surface text-forest hover:border-forest/60 hover:bg-forest-wash",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  danger: "bg-busy text-white hover:bg-[#8b3521]",
  quiet: "bg-forest-tint text-forest-deep hover:bg-[#d2dfcd]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 rounded-[9px] px-3 text-sm",
  md: "h-11 rounded-field px-4 text-[15px]",
  lg: "h-12 rounded-field px-5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant, size, loading, icon, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant, size, icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
