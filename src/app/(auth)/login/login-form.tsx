"use client";

import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { requestOtp, type FormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { emailSchema, isAllowedEmail } from "@/lib/auth/domains";

export function LoginForm({ next, domains }: { next: string; domains: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestOtp, null);
  const [clientError, setClientError] = useState<string | null>(null);
  const emailError = clientError ?? state?.fieldErrors?.email ?? null;
  const domainHint = domains.map((d) => `@${d}`).join(" or ");

  // Client-side check is only for fast feedback; the server re-validates.
  function validate(form: HTMLFormElement) {
    const value = String(new FormData(form).get("email") ?? "");
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) return parsed.error.issues[0].message;
    if (!isAllowedEmail(parsed.data, domains)) return `Use your SRM student email (${domainHint}).`;
    return null;
  }

  return (
    <form
      action={action}
      noValidate
      className="mt-7 space-y-5"
      onSubmit={(e) => {
        const err = validate(e.currentTarget);
        setClientError(err);
        if (err) e.preventDefault();
      }}
    >
      <input type="hidden" name="next" value={next} />
      <Field label="College email" htmlFor="email" error={emailError} hint={`Your SRM student address, ending in ${domainHint}`}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={`yourname${domainHint.split(" ")[0]}`}
          defaultValue={state?.values?.email ?? ""}
          icon={<Mail className="size-4.5" />}
          invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-error" : "email-hint"}
          onChange={() => clientError && setClientError(null)}
          required
        />
      </Field>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Sending code…" : "Send sign-in code"}
      </Button>
    </form>
  );
}
