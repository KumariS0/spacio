/**
 * Maps machine-readable codes raised by the database functions (and returned
 * by the QR state machine) to safe, human copy. Unknown errors never leak
 * internals — they fall back to a generic message.
 */
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Your session has ended. Please sign in again.",
  NOT_VERIFIED: "Only verified SRM student accounts can do this.",
  FORBIDDEN: "You don't have permission to do that.",
  FACILITY_NOT_FOUND: "This space isn't available any more.",
  FACILITY_CLOSED: "This space is temporarily closed.",
  WRONG_BOOKING_MODE: "This space can't be booked that way.",
  INVALID_TIME: "Pick one of the listed time slots.",
  DURATION_TOO_LONG: "That's longer than this space allows in one booking.",
  IN_PAST: "That time slot has already finished.",
  TOO_FAR_AHEAD: "That's too far ahead. Bookings open a few days in advance.",
  OUTSIDE_HOURS: "The space isn't open for that whole time.",
  TOO_MANY_RESERVATIONS: "You already have the maximum number of upcoming bookings. Cancel one to book another.",
  SEAT_NOT_FOUND: "That seat no longer exists.",
  SEAT_UNAVAILABLE: "That seat is out of service right now.",
  SEAT_TAKEN: "Someone just booked that seat. Pick another one.",
  USER_CONFLICT: "You already have a booking that overlaps this time.",
  CAPACITY_FULL: "That time slot just filled up. Try another slot.",
  RESERVATION_NOT_FOUND: "We couldn't find that booking on your account.",
  CANNOT_CANCEL: "This booking can no longer be cancelled.",
  INVALID_LAYOUT: "Rows must be 1–26 and columns 1–40.",
  PROFILE_NOT_FOUND: "No SPACIO account uses that email yet.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  NETWORK: "You seem to be offline. Check your connection and try again.",
  NOT_CONFIGURED: "SPACIO isn't connected to its database yet. An administrator needs to finish the setup.",
};

export function messageFor(code: string | null | undefined, fallback = "Something went wrong. Please try again.") {
  if (!code) return fallback;
  return MESSAGES[code] ?? fallback;
}

type MaybePgError = { message?: string; code?: string } | null | undefined;

/** Extracts our business code from a Supabase/PostgREST error, if present. */
export function codeFrom(error: MaybePgError): string | null {
  if (!error) return null;
  const msg = (error.message ?? "").trim();
  if (/^[A-Z][A-Z_]{2,40}$/.test(msg)) return msg;
  if (/fetch failed|network|Failed to fetch/i.test(msg)) return "NETWORK";
  return null;
}

export function friendlyError(error: MaybePgError, fallback?: string) {
  return messageFor(codeFrom(error), fallback);
}
