"use client";

import { useActionState } from "react";
import { Mail, User, IdCard } from "lucide-react";
import { completeProfile, type FormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

export function ProfileForm({
  email,
  defaults,
  submitLabel,
  redirectTo,
}: {
  email: string;
  defaults?: { full_name?: string | null; register_number?: string | null };
  submitLabel: string;
  redirectTo?: "/profile" | "/home";
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(completeProfile, null);
  const v = state?.values;
  return (
    <form action={action} className="mt-7 space-y-5" noValidate>
      {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
      <Field label="Verified college email" htmlFor="email-ro">
        <Input id="email-ro" value={email} readOnly disabled icon={<Mail className="size-4.5" />} />
      </Field>
      <Field label="Full name" htmlFor="full_name" error={state?.fieldErrors?.full_name}>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          placeholder="Enter your full name"
          defaultValue={v?.full_name ?? defaults?.full_name ?? ""}
          icon={<User className="size-4.5" />}
          invalid={Boolean(state?.fieldErrors?.full_name)}
          aria-describedby={state?.fieldErrors?.full_name ? "full_name-error" : undefined}
          required
        />
      </Field>
      <Field
        label="Register number"
        htmlFor="register_number"
        optional
        error={state?.fieldErrors?.register_number}
        hint="Only you and SPACIO administrators can see this."
      >
        <Input
          id="register_number"
          name="register_number"
          autoCapitalize="characters"
          placeholder="e.g. RA2111003010000"
          defaultValue={v?.register_number ?? defaults?.register_number ?? ""}
          icon={<IdCard className="size-4.5" />}
          invalid={Boolean(state?.fieldErrors?.register_number)}
          aria-describedby={state?.fieldErrors?.register_number ? "register_number-error" : "register_number-hint"}
        />
      </Field>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
