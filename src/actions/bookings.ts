"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { codeFrom, messageFor } from "@/lib/errors";

type Result = { ok: true; id: string } | { ok: false; code: string; error: string };

const bookingInput = z.object({
  facilityId: z.uuid(),
  seatId: z.uuid().nullable(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
});

/**
 * Creates a reservation through the database RPC. All rules (availability,
 * overlap, capacity, hours, limits) are enforced in Postgres; this action only
 * validates the shape of the request and maps errors to friendly copy.
 */
export async function createBooking(input: z.input<typeof bookingInput>): Promise<Result> {
  const parsed = bookingInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_TIME", error: messageFor("INVALID_TIME") };
  const { facilityId, seatId, startsAt, endsAt } = parsed.data;

  const supabase = await createClient();
  const { data, error } = seatId
    ? await supabase.rpc("book_seat", { p_seat_id: seatId, p_starts_at: startsAt, p_ends_at: endsAt })
    : await supabase.rpc("book_capacity", { p_facility_id: facilityId, p_starts_at: startsAt, p_ends_at: endsAt });

  if (error || !data) {
    const code = codeFrom(error) ?? "UNKNOWN";
    if (code === "UNKNOWN") console.error("booking failed", error?.code, error?.message);
    return { ok: false, code, error: messageFor(code, "We couldn't complete the booking. Please try again.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, id: data as string };
}

export async function cancelBooking(reservationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.uuid().safeParse(reservationId).success) return { ok: false, error: messageFor("RESERVATION_NOT_FOUND") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_reservation", { p_reservation_id: reservationId });
  if (error) return { ok: false, error: messageFor(codeFrom(error)) };
  revalidatePath("/", "layout");
  return { ok: true };
}
