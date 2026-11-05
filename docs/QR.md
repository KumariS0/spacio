# QR check-in and check-out

SPACIO supports two ways to check in. **Booking passes** are the main one; entrance codes still work as an alternative.

## Booking passes (main flow)

Every booking has its own random pass token (`reservations.pass_token`, 43 URL-safe characters). The student sees it as a QR code at the top of the booking, on the confirmation page and under **My pass** (`/pass`). The QR holds only a link:

```
https://YOUR-SITE/admin/scan?p=<pass token>
```

1. The student shows the pass at the entrance.
2. An admin opens **Admin → Scan passes** (`/admin/scan`) and scans it with the camera, a photo, or by typing the code under "Can't be scanned?". Opening the link with a phone's camera app works too.
3. SPACIO shows the student's name, email, register number, space, seat and time, so the admin can check it's the right person.
4. **Check in** is offered only inside the booking's check-in window. **Check out** is offered only after check-in. `staff_lookup_pass` and `staff_pass_action` enforce this in the database; both are admin-only. Repeat taps return `ALREADY_CHECKED_IN` or `DONE` and change nothing.
5. The reservation records `checked_in_by` / `checked_out_by`, and every pass scan is logged in `qr_scan_events` (`pass_check_in` / `pass_check_out`).

A pass stops working when the booking is cancelled, missed (no-show) or finished. It's tied to the student's account, so it shouldn't be shared. Because the admin sees the student's name on every scan, a forwarded screenshot can be caught at the door.

**Testing on one computer:** open the booking's pass, copy the code under "Can't be scanned?", then paste it into **Admin → Scan passes → Type pass code**.

## Entrance QR codes (alternative)

### What's in the code

Each facility has one active code containing a plain link:

```
https://YOUR-SITE/scan?t=<random 24-character token>
```

The token is random and means nothing on its own. The code contains **no student data and no secrets**. Scanning with a phone's normal camera opens SPACIO's scan page. The in-site scanner at `/scan` reads the same code, and students can also type the token if the camera doesn't work.

### The flow (enforced by the database, `scan_facility` / `confirm_checkout`)

| Student's situation when scanning | Result |
| --- | --- |
| Has a booking here that starts within the check-in window (from *early check-in* minutes before the start until *grace* minutes after) | **Checked in.** The seat shows as occupied |
| Booking here hasn't reached its check-in window yet | "Too early", with the time check-in opens |
| Already checked in here | Asked to **confirm check-out**, which frees the seat immediately |
| Scans again within 30 seconds of checking in | Treated as an accidental double scan; nothing changes |
| Has a booking somewhere else | Told which space the booking is for |
| No booking | Offered a link to book this space |
| Unknown or replaced code | "This QR code isn't valid" |

Bookings not checked in by the end of the grace period become **no-shows** and are released. Sessions that aren't checked out end automatically at the booking's end time. Scans are rate-limited per student and logged in `qr_scan_events`.

### Known limitation: static codes

A printed code can be photographed and scanned elsewhere, so it proves that someone saw the code, not that they're standing at the door. For a student project this is a reasonable trade-off, and it's mitigated by the following:
- Check-in only works for the student's own booking in its time window.
- Every scan is logged, and admins can **Replace** a code instantly.

Stronger options for later:
- A **rotating code** on a screen at the entrance, with a token that changes every 30–60 seconds. The schema already supports multiple tokens.
- Check-in by **staff**, who scan the student's booking code instead.
- Location checks. This needs verified coordinates and the student's permission, and can be spoofed.
