"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const input = z.object({ facilityId: z.uuid(), favorite: z.boolean() });

export async function setFavorite(facilityId: string, favorite: boolean) {
  const parsed = input.safeParse({ facilityId, favorite });
  if (!parsed.success) return { ok: false as const, error: "Invalid request." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, error: "Please sign in again." };

  // RLS guarantees a student can only write rows where user_id = their own id.
  const { error } = favorite
    ? await supabase.from("favorites").upsert({ user_id: auth.user.id, facility_id: facilityId }, { onConflict: "user_id,facility_id", ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("user_id", auth.user.id).eq("facility_id", facilityId);

  if (error) return { ok: false as const, error: "Couldn't update your saved spaces. Try again." };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
