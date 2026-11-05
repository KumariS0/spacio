"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { resendOtp, verifyOtp, type FormState } from "@/actions/auth";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";

export function VerifyForm({ length, initialCooldown }: { length: number; initialCooldown: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyOtp, null);
  const [resendState, setResendState] = useState<FormState>(null);
  const [resending, startResend] = useTransition();
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [attempt, setAttempt] = useState(0);
  const tokenError = state?.fieldErrors?.token;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function resend() {
    startResend(async () => {
      const res = await resendOtp();
      setResendState(res);
      if (res?.cooldown) setCooldown(res.cooldown);
      if (res?.message) setAttempt((a) => a + 1); // clear the boxes for the new code
    });
  }

  return (
    <div className="mt-7 space-y-5">
      <form action={action} className="space-y-5" noValidate>
        <div className="space-y-2">
          <OtpInput key={attempt} length={length} name="token" invalid={Boolean(tokenError)} describedBy={tokenError ? "token-error" : undefined} autoFocus />
          {tokenError && (
            <p id="token-error" role="alert" className="text-sm text-busy">
              {tokenError}
            </p>
          )}
        </div>
        {state?.error && (
          <Alert tone="error" action={<Link className="font-semibold underline underline-offset-2" href="/login">Start again</Link>}>
            {state.error}
          </Alert>
        )}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>

      {resendState?.message && <Alert tone="success">{resendState.message}</Alert>}
      {resendState?.error && <Alert tone="warning">{resendState.error}</Alert>}

      <div className="flex flex-col items-center gap-1 text-sm text-muted">
        <p>Didn&apos;t get it? Check your spam folder.</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || resending}
            className="tabular font-semibold text-forest underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:font-normal disabled:text-muted disabled:no-underline"
          >
            {resending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          <span aria-hidden className="text-line-strong">|</span>
          <Link href="/login" className="font-semibold text-forest underline-offset-2 hover:underline">
            Use a different email
          </Link>
        </div>
      </div>
    </div>
  );
}
