"use client";

import { Heart } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setFavorite } from "@/actions/favorites";
import { cn } from "@/lib/cn";

export function FavoriteButton({
  facilityId,
  facilityName,
  isFavorite,
  className,
  withLabel,
}: {
  facilityId: string;
  facilityName: string;
  isFavorite: boolean;
  className?: string;
  withLabel?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const res = await setFavorite(facilityId, next);
      if (!res.ok) toast.error(res.error);
      else toast.success(next ? `Saved ${facilityName}` : `Removed ${facilityName} from saved`);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      aria-label={optimistic ? `Remove ${facilityName} from saved spaces` : `Save ${facilityName}`}
      data-pending={pending || undefined}
      className={cn(
        "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full text-forest transition-transform duration-150 active:scale-90",
        withLabel ? "h-10 border border-line bg-surface px-3.5 text-sm font-medium hover:bg-forest-wash" : "size-10 hover:bg-forest-wash",
        className,
      )}
    >
      <Heart className={cn("size-5 transition-[fill,transform] duration-200", optimistic && "fill-forest")} aria-hidden />
      {withLabel && <span>{optimistic ? "Saved" : "Save"}</span>}
    </button>
  );
}
