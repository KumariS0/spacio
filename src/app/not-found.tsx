import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="max-w-sm text-center">
        <Logo className="mx-auto mb-8" />
        <p className="font-serif text-6xl text-forest">404</p>
        <h1 className="mt-3 text-2xl text-ink">This page doesn’t exist</h1>
        <p className="mt-2 text-muted">The link may be old, or the space may have been removed.</p>
        <ButtonLink href="/home" size="lg" className="mt-8">Go to SPACIO home</ButtonLink>
      </div>
    </main>
  );
}
