"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl text-ink">Something went wrong</h1>
        <p className="mt-2 text-muted">We couldn’t load this page. Check your connection and try again.</p>
        {error.digest && <p className="mt-3 font-mono text-xs text-muted">Reference: {error.digest}</p>}
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" onClick={reset}>Try again</Button>
          <ButtonLink href="/home" size="lg" variant="secondary">Home</ButtonLink>
        </div>
      </div>
    </main>
  );
}
