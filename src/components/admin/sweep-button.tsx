"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { sweepNow } from "@/actions/admin";
import { Button } from "@/components/ui/button";

export function SweepButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      icon={<RefreshCw className="size-4" aria-hidden />}
      onClick={() =>
        start(async () => {
          const res = await sweepNow();
          if (res?.error) toast.error(res.error);
          else toast.success(res?.message ?? "Done");
        })
      }
    >
      Release no-shows now
    </Button>
  );
}
