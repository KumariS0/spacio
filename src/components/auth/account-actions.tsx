"use client";

import { useActionState, useTransition } from "react";
import { ChevronRight, LogOut, Trash2 } from "lucide-react";
import { deleteAccount, signOut, type FormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogRoot, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

const rowClass = "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] hover:bg-paper/70";

export function LogoutButton() {
  const [pending, start] = useTransition();
  return (
    <DialogRoot>
      <DialogTrigger className={`${rowClass} text-busy`}>
        <LogOut className="size-4.5" aria-hidden />
        <span className="flex-1">Log out</span>
        <ChevronRight className="size-4 text-muted" aria-hidden />
      </DialogTrigger>
      <DialogContent title="Log out?" description="Are you sure you want to log out of your SPACIO account?" icon={<LogOut className="size-6" aria-hidden />}>
        <div className="grid grid-cols-2 gap-3">
          <DialogClose asChild>
            <Button variant="secondary" size="lg">Cancel</Button>
          </DialogClose>
          <Button size="lg" loading={pending} onClick={() => start(() => signOut())}>
            Log out
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

export function DeleteAccountButton() {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, null);
  return (
    <DialogRoot>
      <DialogTrigger className={`${rowClass} text-busy`}>
        <Trash2 className="size-4.5" aria-hidden />
        <span className="flex-1">Delete account</span>
        <ChevronRight className="size-4 text-muted" aria-hidden />
      </DialogTrigger>
      <DialogContent
        title="Delete your account?"
        description="This permanently removes your profile, bookings and saved spaces. Upcoming bookings are released. This can't be undone."
        icon={<Trash2 className="size-6" aria-hidden />}
      >
        <form action={action} className="space-y-4">
          <Field label='Type "DELETE" to confirm' htmlFor="confirm" error={state?.fieldErrors?.confirm}>
            <Input id="confirm" name="confirm" autoComplete="off" autoCapitalize="characters" invalid={Boolean(state?.fieldErrors?.confirm)} />
          </Field>
          {state?.error && <Alert tone="error">{state.error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="lg">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="danger" size="lg" loading={pending}>
              Delete
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
