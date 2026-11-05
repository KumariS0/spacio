"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { codeFrom, messageFor } from "@/lib/errors";
import { isValidToken } from "@/lib/qr";
import type { ScanResult } from "@/lib/types";

type ActionResult = { ok: true; data: ScanResult } | { ok: false; error: string };

/**
 * Sends a scanned facility token to the database state machine
 * (public.scan_facility). The server decides what the scan means for the
 * signed-in student; the client never toggles reservation state itself.
 */
export async function scanFacility(token: string): Promise<ActionResult> {
  if (!isValidToken(token)) return { ok: true, data: { result: "INVALID_QR" } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("scan_facility", { p_token: token });
  if (error) return { ok: false, error: messageFor(codeFrom(error), "We couldn't process that scan. Please try again.") };
  const result = data as ScanResult;
  if (result.result === "CHECKED_IN") revalidatePath("/", "layout");
  return { ok: true, data: result };
}

export async function confirmCheckout(reservationId: string, token: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(reservationId).success || !isValidToken(token)) {
    return { ok: true, data: { result: "INVALID_QR" } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_checkout", { p_reservation_id: reservationId, p_token: token });
  if (error) return { ok: false, error: messageFor(codeFrom(error), "We couldn't check you out. Please try again.") };
  const result = data as ScanResult;
  if (result.result === "CHECKED_OUT") revalidatePath("/", "layout");
  return { ok: true, data: result };
}
