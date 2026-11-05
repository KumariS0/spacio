"use client";

import * as RD from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const DialogRoot = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

/** Centered modal on desktop, bottom sheet on phones. Focus is trapped by Radix. */
export function DialogContent({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px] data-[state=open]:animate-fade" />
      <RD.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[var(--radius-sheet)] border border-line bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-pop data-[state=open]:animate-rise",
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-sheet)] sm:pb-6",
          className,
        )}
      >
        <div className="flex flex-col items-center text-center">
          {icon && <div className="mb-4 grid size-14 place-items-center rounded-full bg-forest-tint text-forest">{icon}</div>}
          <RD.Title className="font-serif text-2xl text-ink">{title}</RD.Title>
          {description ? (
            <RD.Description className="mt-2 text-sm leading-relaxed text-muted">{description}</RD.Description>
          ) : (
            <RD.Description className="sr-only">{title}</RD.Description>
          )}
        </div>
        {children && <div className="mt-6">{children}</div>}
      </RD.Content>
    </RD.Portal>
  );
}
