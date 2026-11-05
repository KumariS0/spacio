"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";
import { Camera, CameraOff, ImageUp, Keyboard, LoaderCircle, LogIn, LogOut, QrCode, RotateCcw, UserRound } from "lucide-react";
import { lookupPass, passAction } from "@/actions/admin";
import { parsePassPayload } from "@/lib/qr";
import { formatDay, formatRange, formatTime } from "@/lib/time";
import type { PassLookup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { Input } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";

type CameraState = "idle" | "starting" | "scanning" | "denied" | "insecure" | "unsupported" | "error";
type Tone = "success" | "info" | "warning" | "error";

/** What happened after an action, or why the pass can't be used right now. */
function describe(p: PassLookup): { tone: Tone; title: string; body?: string } | null {
  const f = p.facility;
  switch (p.result) {
    case "CHECKED_IN":
      return { tone: "success", title: "Checked in", body: "Their place is now marked as occupied." };
    case "CHECKED_OUT":
      return { tone: "success", title: "Checked out", body: "Their place has been released." };
    case "ALREADY_CHECKED_IN":
      return { tone: "info", title: "Already checked in", body: "Scan again when they leave to check them out." };
    case "NOT_CHECKED_IN":
      return { tone: "warning", title: "Not checked in yet", body: "Check them in first." };
    case "INVALID_PASS":
      return { tone: "error", title: "Not a valid SPACIO pass", body: "Ask the student to open the pass in their SPACIO booking." };
  }
  switch (p.state) {
    case "TOO_EARLY":
      return { tone: "warning", title: "Too early to check in", body: f ? `Check-in opens at ${formatTime(f.checkin_opens_at)}.` : undefined };
    case "MISSED":
      return { tone: "error", title: "Check-in window has passed", body: "The booking was released as a no-show. They'll need to book again." };
    case "DONE":
      return { tone: "info", title: "This booking has ended", body: "It's already checked out or past its end time." };
    case "CANCELLED":
      return { tone: "error", title: "This booking was cancelled" };
    case "UNAVAILABLE":
      return { tone: "error", title: "Space unavailable", body: "The space is inactive or temporarily closed." };
  }
  return null;
}

export function PassScanner({ initialToken }: { initialToken: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const busyRef = useRef(false);
  const [camera, setCamera] = useState<CameraState>("idle");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [pass, setPass] = useState<PassLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualValue, setManualValue] = useState("");

  const pauseCamera = useCallback(() => scannerRef.current?.stop(), []);

  const open = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      const t = parsePassPayload(raw);
      setError(null);
      if (!t) {
        setToken(null);
        setPass({ result: "INVALID_PASS" });
        return;
      }
      busyRef.current = true;
      setBusy(true);
      pauseCamera();
      const res = await lookupPass(t);
      busyRef.current = false;
      setBusy(false);
      if (res.error) setError(res.error);
      setToken(t);
      setPass(res.data ?? null);
    },
    [pauseCamera],
  );

  async function act(action: "check_in" | "check_out") {
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const res = await passAction(token, action);
    busyRef.current = false;
    setBusy(false);
    if (res.error) setError(res.error);
    if (res.data) setPass(res.data);
  }

  const startCamera = useCallback(async () => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCamera("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    setCamera("starting");
    try {
      const { default: QrScanner } = await import("qr-scanner");
      if (!videoRef.current) return;
      scannerRef.current?.destroy();
      const scanner = new QrScanner(videoRef.current, (r) => void open(r.data), {
        preferredCamera: "environment",
        highlightScanRegion: false,
        highlightCodeOutline: false,
        maxScansPerSecond: 6,
        returnDetailedScanResult: true,
      });
      scannerRef.current = scanner;
      await scanner.start();
      setCamera("scanning");
    } catch (e) {
      const name = (e as { name?: string })?.name ?? String(e);
      setCamera(/NotAllowed|Permission|denied/i.test(name) ? "denied" : /NotFound|no camera/i.test(name) ? "unsupported" : "error");
    }
  }, [open]);

  function next() {
    setPass(null);
    setToken(null);
    setError(null);
    setManualValue("");
    if (scannerRef.current && camera === "scanning") void scannerRef.current.start();
  }

  async function scanFile(file: File) {
    try {
      const { default: QrScanner } = await import("qr-scanner");
      const r = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      void open(r.data);
    } catch {
      setError("No QR code found in that photo. Try a clearer, closer picture.");
    }
  }

  // A pass opened with a phone's camera app arrives as /admin/scan?p=…
  const handledInitial = useRef(false);
  useEffect(() => {
    if (initialToken && !handledInitial.current) {
      handledInitial.current = true;
      queueMicrotask(() => void open(initialToken));
    }
  }, [initialToken, open]);

  useEffect(() => () => scannerRef.current?.destroy(), []);

  const outcome = pass ? describe(pass) : null;
  const r = pass?.reservation;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] bg-[#13231c] sm:aspect-[4/3]">
          <video ref={videoRef} className={cn("absolute inset-0 size-full object-cover", camera !== "scanning" && "invisible")} muted playsInline aria-label="Camera preview" />
          {camera === "scanning" && pass && (
            <div className="absolute inset-0 grid place-items-center bg-[#13231c]/70 text-sm font-medium text-white">Paused — press “Scan next pass”</div>
          )}
          {camera !== "scanning" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
              {camera === "starting" ? (
                <>
                  <LoaderCircle className="size-8 animate-spin opacity-80" aria-hidden />
                  <p className="text-sm opacity-90">Starting camera… allow access if your browser asks.</p>
                </>
              ) : camera === "idle" ? (
                <>
                  <span className="grid size-16 place-items-center rounded-full bg-white/10">
                    <QrCode className="size-8" aria-hidden />
                  </span>
                  <Button size="lg" onClick={startCamera} icon={<Camera className="size-4.5" aria-hidden />} className="bg-white text-forest-deep hover:bg-paper">
                    Start camera
                  </Button>
                </>
              ) : (
                <>
                  <CameraOff className="size-9 opacity-80" aria-hidden />
                  <p className="max-w-xs text-sm opacity-90">
                    {camera === "insecure"
                      ? "The live camera needs a secure (https) page. Use “Take or upload a photo” or type the pass code below."
                      : camera === "denied"
                        ? "Camera access is blocked. Allow it in your browser settings, or use a photo or the pass code."
                        : camera === "unsupported"
                          ? "No camera is available here. Use a photo or the pass code."
                          : "The camera couldn't start. Close other apps using it and try again."}
                  </p>
                  {(camera === "denied" || camera === "error") && <Button variant="secondary" onClick={startCamera}>Try again</Button>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setManual((m) => !m)} icon={<Keyboard className="size-4" aria-hidden />} aria-expanded={manual}>
            Type pass code
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
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void open(manualValue);
            }}
          >
            <label htmlFor="pass-code" className="sr-only">Pass code or link</label>
            <Input id="pass-code" value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Pass code (under “Can’t be scanned?”)" autoComplete="off" />
            <Button type="submit" className="h-12" loading={busy}>Look up</Button>
          </form>
        )}
      </div>

      <div aria-live="polite" className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {busy && !pass && (
          <p className="flex items-center gap-2 text-sm text-muted" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Looking up the pass…
          </p>
        )}

        {!pass && !busy && !error && (
          <div className="rounded-card border border-dashed border-line-strong p-6 text-center text-sm leading-relaxed text-muted">
            Scan a student’s booking pass. You’ll see who it belongs to and their booking, then check them in or out.
          </div>
        )}

        {pass && (
          <>
            {outcome && (
              <Alert tone={outcome.tone} title={outcome.title}>
                {outcome.body}
              </Alert>
            )}

            {r && pass.facility && (
              <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-label="Booking">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-tint text-forest">
                      <UserRound className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-serif text-xl leading-tight text-ink">{pass.student?.name || "Student"}</p>
                      <p className="truncate text-sm text-muted">
                        {pass.student?.email}
                        {pass.student?.register_number ? ` · ${pass.student.register_number}` : ""}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <dl className="mt-4 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Space</dt>
                    <dd className="font-medium text-ink">
                      {pass.facility.name}
                      {r.seat_label ? ` · Seat ${r.seat_label}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Where</dt>
                    <dd className="text-ink">{[pass.facility.building, pass.facility.floor_label].filter(Boolean).join(" · ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">When</dt>
                    <dd className="text-ink">
                      {formatDay(r.starts_at)}, <span className="whitespace-nowrap">{formatRange(r.starts_at, r.ends_at)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Check-in window</dt>
                    <dd className="text-ink">
                      <span className="whitespace-nowrap">{formatTime(pass.facility.checkin_opens_at)}</span>–<span className="whitespace-nowrap">{formatTime(pass.facility.checkin_deadline)}</span>
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-muted">Check the name matches the person in front of you before checking them in.</p>

                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                  {pass.state === "CHECK_IN" && (
                    <Button size="lg" className="sm:flex-1" loading={busy} onClick={() => act("check_in")} icon={<LogIn className="size-4.5" aria-hidden />}>
                      Check in
                    </Button>
                  )}
                  {pass.state === "CHECK_OUT" && (
                    <Button size="lg" className="sm:flex-1" loading={busy} onClick={() => act("check_out")} icon={<LogOut className="size-4.5" aria-hidden />}>
                      Check out
                    </Button>
                  )}
                  <Button size="lg" variant="secondary" className="sm:flex-1" onClick={next} icon={<RotateCcw className="size-4.5" aria-hidden />}>
                    Scan next pass
                  </Button>
                </div>
              </section>
            )}

            {!r && (
              <Button size="lg" variant="secondary" onClick={next} icon={<RotateCcw className="size-4.5" aria-hidden />}>
                Scan next pass
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
