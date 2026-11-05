"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Segmented one-time-code input. A single hidden <input name> carries the
 * value so the form posts normally; boxes support paste, arrows and backspace.
 */
export function OtpInput({ length, name, invalid, describedBy, autoFocus }: { length: number; name: string; invalid?: boolean; describedBy?: string; autoFocus?: boolean }) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setAt(i: number, value: string) {
    setDigits((d) => {
      const next = [...d];
      next[i] = value;
      return next;
    });
  }

  function fill(from: number, text: string) {
    const clean = text.replace(/\D/g, "").slice(0, length - from);
    if (!clean) return;
    setDigits((d) => {
      const next = [...d];
      clean.split("").forEach((ch, k) => (next[from + k] = ch));
      return next;
    });
    refs.current[Math.min(from + clean.length, length - 1)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label={`${length}-digit code`}>
      <input type="hidden" name={name} value={digits.join("")} />
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          maxLength={length}
          className={cn(
            "tabular h-14 w-full min-w-0 rounded-field border bg-surface text-center font-serif text-2xl text-ink transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-[3px]",
            invalid ? "border-busy focus:ring-busy/15" : "border-line focus:border-forest focus:ring-forest/15",
          )}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (v.length > 1) return fill(i, v);
            setAt(i, v);
            if (v && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            fill(i, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
              setAt(i - 1, "");
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
