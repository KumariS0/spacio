"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type QrScannerType from "qr-scanner";
import { Camera, CameraOff, ImageUp, Keyboard, LoaderCircle, QrCode, ScanLine } from "lucide-react";
import { scanFacility } from "@/actions/scan";
import { parseQrPayload } from "@/lib/qr";
import { formatTime } from "@/lib/time";
import type { ScanResult } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type CameraState = "idle" | "starting" | "scanning" | "denied" | "insecure" | "unsupported" | "error";

export function Scanner({ initialToken }: { initialToken: string | null }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ token: string; at: number } | null>(null);
  const [camera, setCamera] = useState<CameraState>("idle");
  const [processing, setProcessing] = useState(false);
  const [outcome, setOutcome] = useState<{ result?: ScanResult; error?: string; notSpacio?: boolean } | null>(() =>
    initialToken && !parseQrPayload(initialToken) ? { notSpacio: true } : null,
  );
  const [manual, setManual] = useState(false);
  const [manualValue, setManualValue] = useState("");

  const stopCamera = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
  }, []);

  const handleToken = useCallback(
    async (token: string) => {
      // Ignore duplicate decodes of the same code while one request is in flight.
      const now = Date.now();
      if (busyRef.current) return;
      if (lastRef.current && lastRef.current.token === token && now - lastRef.current.at < 3000) return;
      busyRef.current = true;
      lastRef.current = { token, at: now };
      setProcessing(true);
      setOutcome(null);
      scannerRef.current?.pause();
      try {
        const res = await scanFacility(token);
        if (!res.ok) {
          setOutcome({ error: res.error });
          return;
        }
        const r = res.data;
        if (r.result === "CHECKED_IN" && r.reservation) {
          stopCamera();
          router.replace(`/scan/checked-in/${r.reservation.id}`);
          return;
        }
        if (r.result === "CONFIRM_CHECKOUT" && r.reservation) {
          stopCamera();
          router.replace(`/scan/checkout/${r.reservation.id}?t=${encodeURIComponent(token)}`);
          return;
        }
        setOutcome({ result: r });
      } catch {
        setOutcome({ error: navigator.onLine ? "Something went wrong. Please try again." : "You're offline. Connect to the internet and scan again." });
      } finally {
        busyRef.current = false;
        setProcessing(false);
      }
    },
    [router, stopCamera],
  );

  const onRaw = useCallback(
    (raw: string) => {
      const token = parseQrPayload(raw);
      if (!token) {
        setOutcome({ notSpacio: true });
        return;
      }
      void handleToken(token);
    },
    [handleToken],
  );

  const startCamera = useCallback(async () => {
    setOutcome(null);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      // Browsers only expose the camera on https:// pages (and localhost).
      setCamera("insecure");
      return;
    }
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    setCamera("starting");
    try {
      const { default: QrScanner } = await import("qr-scanner");
      if (!(await QrScanner.hasCamera())) {
        setCamera("unsupported");
        return;
      }
      if (!videoRef.current) return;
      stopCamera();
      const scanner = new QrScanner(videoRef.current, (res) => onRaw(res.data), {
        preferredCamera: "environment",
        highlightScanRegion: false,
        highlightCodeOutline: false,
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
      });
      scannerRef.current = scanner;
      await scanner.start();
      setCamera("scanning");
    } catch (e) {
      const name = (e as { name?: string })?.name ?? String(e);
      setCamera(/NotAllowed|Permission|denied/i.test(name) ? "denied" : /NotFound|Overconstrained|no camera/i.test(name) ? "unsupported" : "error");
    }
  }, [onRaw, stopCamera]);

  // A code opened from the phone's own camera app arrives as /scan?t=…
  const handledInitial = useRef(false);
  useEffect(() => {
    if (initialToken && !handledInitial.current) {
      handledInitial.current = true;
      const token = parseQrPayload(initialToken);
      // Deferred so the check-in request starts after the first paint.
      if (token) queueMicrotask(() => void handleToken(token));
    }
  }, [initialToken, handleToken]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function scanFile(file: File) {
    setOutcome(null);
    try {
      const { default: QrScanner } = await import("qr-scanner");
      const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      onRaw(res.data);
    } catch {
      setOutcome({ error: "No QR code found in that photo. Try a clearer, closer picture." });
    }
  }

  const resume = () => {
    setOutcome(null);
    if (scannerRef.current) void scannerRef.current.start();
  };

  return (
    <div className="space-y-5">
      <div className="relative aspect-square w-full overflow-hidden rounded-[22px] bg-[#13231c] sm:aspect-[4/3]">
        <video ref={videoRef} className={cn("absolute inset-0 size-full object-cover", camera !== "scanning" && "invisible")} muted playsInline aria-label="Camera preview" />
        {camera === "scanning" && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative size-[62%] max-w-72 rounded-[22px] shadow-[0_0_0_9999px_rgb(10_20_15/0.45)]">
              {["left-0 top-0 border-l-4 border-t-4 rounded-tl-[22px]", "right-0 top-0 border-r-4 border-t-4 rounded-tr-[22px]", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[22px]", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-[22px]"].map((c) => (
                <span key={c} className={cn("absolute size-10 border-white", c)} />
              ))}
              {!processing && <span className="absolute inset-x-5 top-1/2 h-0.5 animate-pulse rounded-full bg-white/70" />}
            </div>
          </div>
        )}
        {camera !== "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
            {camera === "starting" ? (
              <>
                <LoaderCircle className="size-8 animate-spin opacity-80" aria-hidden />
                <p className="text-sm opacity-90">Starting camera… allow access if your browser asks.</p>
              </>
            ) : camera === "denied" ? (
              <>
                <CameraOff className="size-9 opacity-80" aria-hidden />
                <div>
                  <p className="font-medium">Camera access is blocked</p>
                  <p className="mt-1 text-sm opacity-80">Allow camera access for this site in your browser settings, then try again — or enter the code below.</p>
                </div>
                <Button variant="secondary" onClick={startCamera}>Try again</Button>
              </>
            ) : camera === "insecure" ? (
              <>
                <CameraOff className="size-9 opacity-80" aria-hidden />
                <div>
                  <p className="font-medium">Live camera needs a secure (https) page</p>
                  <p className="mt-1 text-sm opacity-80">
                    Tap <strong>Take or upload a photo</strong> below to use your phone&apos;s camera instead, or type the entry code printed under the QR.
                  </p>
                </div>
              </>
            ) : camera === "unsupported" ? (
              <>
                <CameraOff className="size-9 opacity-80" aria-hidden />
                <div>
                  <p className="font-medium">No camera available</p>
                  <p className="mt-1 text-sm opacity-80">This browser or device can&apos;t use a camera here (it needs HTTPS). Upload a photo of the QR or type the code instead.</p>
                </div>
              </>
            ) : camera === "error" ? (
              <>
                <CameraOff className="size-9 opacity-80" aria-hidden />
                <p className="text-sm opacity-90">The camera couldn&apos;t start. Close other apps using it and try again.</p>
                <Button variant="secondary" onClick={startCamera}>Try again</Button>
              </>
            ) : (
              <>
                <span className="grid size-16 place-items-center rounded-full bg-white/10">
                  <QrCode className="size-8" aria-hidden />
                </span>
                <Button size="lg" onClick={startCamera} icon={<Camera className="size-4.5" aria-hidden />} className="bg-white text-forest-deep hover:bg-paper">
                  Start camera
                </Button>
              </>
            )}
          </div>
        )}
        {processing && (
          <div className="absolute inset-0 grid place-items-center bg-[#13231c]/60 text-white" role="status">
            <span className="flex items-center gap-2 text-sm font-medium">
              <LoaderCircle className="size-5 animate-spin" aria-hidden /> Checking your booking…
            </span>
          </div>
        )}
      </div>

      <div aria-live="polite">
        {outcome && <ScanOutcome outcome={outcome} onRetry={resume} />}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setManual((m) => !m)} icon={<Keyboard className="size-4" aria-hidden />} aria-expanded={manual}>
          Enter code manually
        </Button>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3 text-sm font-medium text-ink-soft hover:bg-sunken hover:text-ink focus-within:outline-2 focus-within:outline-forest">
          <ImageUp className="size-4" aria-hidden />
          Take or upload a photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void scanFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {manual && (
        <form
          className="flex animate-rise gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onRaw(manualValue);
          }}
        >
          <label htmlFor="manual-code" className="sr-only">QR code text or link</label>
          <Input id="manual-code" value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Entry code (or link) printed under the QR" autoComplete="off" />
          <Button type="submit" className="h-12" loading={processing}>
            Submit
          </Button>
        </form>
      )}

      <p className="flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-muted">
        <ScanLine className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Scanning only works for your own bookings. The QR identifies the space; SPACIO checks your account on the server.
      </p>
    </div>
  );
}

function ScanOutcome({ outcome, onRetry }: { outcome: { result?: ScanResult; error?: string; notSpacio?: boolean }; onRetry: () => void }) {
  const again = (
    <Button size="sm" variant="secondary" onClick={onRetry}>
      Scan again
    </Button>
  );
  if (outcome.notSpacio) return <Alert tone="warning" title="Not a SPACIO code" action={again}>This QR code doesn&apos;t belong to a SPACIO space.</Alert>;
  if (outcome.error) return <Alert tone="error" action={again}>{outcome.error}</Alert>;
  const r = outcome.result!;
  const name = r.facility?.name ?? "this space";
  const slug = r.facility?.slug;
  switch (r.result) {
    case "INVALID_QR":
      return <Alert tone="error" title="Code not recognised" action={again}>This QR code isn&apos;t active. It may have been replaced — look for the current code at the entrance.</Alert>;
    case "RATE_LIMITED":
      return <Alert tone="warning" title="Slow down" action={again}>Too many scans in a short time. Wait a minute and try again.</Alert>;
    case "FACILITY_UNAVAILABLE":
      return <Alert tone="warning" title={`${name} is closed`}>This space is temporarily unavailable.</Alert>;
    case "NOT_BOOKABLE":
      return <Alert tone="info" title={name}>This space is location-only — there&apos;s nothing to check in to.</Alert>;
    case "JUST_CHECKED_IN":
      return (
        <Alert tone="success" title="You're already checked in" action={r.reservation && <ButtonLink size="sm" variant="secondary" href={`/bookings/${r.reservation.id}`}>View booking</ButtonLink>}>
          You checked in to {name} a moment ago. To check out later, scan this code again when you leave.
        </Alert>
      );
    case "TOO_EARLY":
      return (
        <Alert tone="info" title="Too early to check in" action={r.reservation && <ButtonLink size="sm" variant="secondary" href={`/bookings/${r.reservation.id}`}>View booking</ButtonLink>}>
          Your booking at {name} starts at {r.reservation ? formatTime(r.reservation.starts_at) : "a later time"}. Check-in opens shortly before that.
        </Alert>
      );
    case "NO_RESERVATION_HERE":
      return (
        <Alert
          tone="warning"
          title={`This is the ${name} code`}
          action={r.other_facility && <Link className="font-semibold underline underline-offset-2" href={`/spaces/${r.other_facility.slug}`}>Go to {r.other_facility.name}</Link>}
        >
          You don&apos;t have a booking here right now{r.other_facility ? ` — your booking is at ${r.other_facility.name}` : ""}. Nothing was changed.
        </Alert>
      );
    case "NO_RESERVATION":
    default:
      return (
        <Alert tone="warning" title={`No booking at ${name}`} action={slug && <ButtonLink size="sm" href={`/spaces/${slug}/book`}>Book {name}</ButtonLink>}>
          You need an active booking to check in. Reserve a place first, then scan again.
        </Alert>
      );
  }
}
