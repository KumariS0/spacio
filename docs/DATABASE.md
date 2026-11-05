# Database

Postgres on Supabase. All schema lives in `supabase/migrations`, and `npm run test:db` runs the same files in an embedded Postgres (PGlite) on every test run.

## Tables

| Table | Purpose | Who can read / write |
| --- | --- | --- |
| `app_settings` | Single row: timezone, booking horizon (7 days), max upcoming bookings (3), scan rate limits | Signed-in read · admin write |
| `allowed_email_domains` | Domains allowed to sign up (`srmist.edu.in`) | Admin |
| `profiles` | One per user: email, name, register number, `role` | Own row (students may edit **only** name and register number) · admin all |
| `buildings`, `facility_categories`, `facilities`, `facility_operating_hours`, `facility_amenities`, `facility_seats` | Campus inventory | Signed-in read · admin write |
| `reservations` | Bookings and their state, plus each booking's random `pass_token` and who checked it in/out | Own rows read-only · admin read. **No direct writes**: only through functions |
| `favorites` | Saved spaces | Own rows |
| `facility_qr_codes` | One active random token per facility | Admin |
| `qr_scan_events` | Every scan and its result (audit + rate limit) | Admin |
| `otp_requests` | Hashed email/IP timestamps for sign-in rate limiting | Service role only |
| `assistant_requests` | Timestamps for Nook's per-student rate limit (no content) | Function only |
| `facility_live` | Version number per facility, broadcast over Realtime | Signed-in read |
| `admin_audit_logs` | Before/after of every inventory, QR, role and staff-cancel change | Admin |

## Reservation states

```
BOOKED ──scan in window──▶ CHECKED_IN ──scan + confirm──▶ CHECKED_OUT
  │                            └──end time passes──────▶ EXPIRED
  ├──student/admin cancels──▶ CANCELLED
  └──grace period passes────▶ NO_SHOW
```

Only `BOOKED` and `CHECKED_IN` hold a seat or place.

## Guarantees

- **No double booking:** `reservations_no_seat_overlap` is an exclusion constraint on `(seat_id, time range)` for active bookings. Postgres rejects the second of two simultaneous bookings, so there's no race window.
- **No overlapping bookings per student:** `reservations_no_user_overlap` applies the same rule per user.
- **Capacity:** `book_capacity` locks the facility row (`FOR UPDATE`) and counts active bookings in every overlapping slot before inserting.
- **Server-side state machine:** `scan_facility` and `confirm_checkout` lock the reservation and validate the owner, facility, token and time window. Clients can't set states directly.
- **Domain enforcement:** the `hook_before_user_created` auth hook rejects other domains. `is_verified_student()` (confirmed email, allowed domain) gates every student function.
- **Roles:** students have no `UPDATE` grant on `profiles.role`. `grant_admin` / `revoke_admin` are executable only by the service role. Role changes are always audited.

## Functions called by the site

| Function | Called by |
| --- | --- |
| `book_seat`, `book_capacity`, `cancel_reservation` | Student |
| `scan_facility`, `confirm_checkout` | Student (QR) |
| `get_facility_availability`, `get_seat_map`, `get_facility_slots`, `get_campus_stats` | Student (aggregates only, never other students' identities) |
| `sweep_reservations` | Anyone signed in (idempotent), pg_cron, cron route |
| `assistant_take_quota` | Nook route, as the student |
| `staff_lookup_pass`, `staff_pass_action` | Admin (booking pass scanner) |
| `get_admin_stats`, `admin_recent_activity`, `admin_list_reservations`, `admin_cancel_reservation`, `admin_rotate_qr`, `admin_generate_seats` | Admin |
| `grant_admin`, `revoke_admin` | Service role (`npm run make-admin`) |

All functions are `SECURITY DEFINER` with an empty `search_path`, and execute rights are granted explicitly. Business errors are raised as short codes (e.g. `SEAT_TAKEN`), which `src/lib/errors.ts` turns into friendly messages.

## Live updates

Triggers bump `facility_live.version` whenever a facility's reservations, seats or settings change. Browsers subscribe to that table over Supabase Realtime and re-fetch the aggregate functions, so private reservation rows are never broadcast. Browsers also poll every 60 seconds and refresh when the tab regains focus or reconnects.
