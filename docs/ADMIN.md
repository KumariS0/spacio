# Admin guide

Admins see an **Admin** link in the top bar and work at `/admin`. Every admin action is checked again by the database, and changes are recorded in **Audit log**.

## Granting access

```bash
npm run make-admin -- name@srmist.edu.in           # grant
npm run make-admin -- name@srmist.edu.in --revoke  # revoke
```

The person must have signed in once first. Roles can't be changed from the website, and a student can't make themselves an admin, because the `role` column isn't writable by users.

## Replacing the demo data with real spaces

The seed creates sample spaces marked **demo data**. For real use:

1. **Buildings**: add your real buildings. Position each one on the schematic map with Map X/Y percentages. Add latitude and longitude **only if you've verified them**; only then do pins appear on the street map.
2. **Facilities → Add facility**: set the name, category, building, floor, description, rules, opening hours, and reservation type:
   - *Seat-based*: students pick a seat. Generate a grid, then fine-tune it in **Seats**.
   - *Capacity-based*: students book one of N places, as at a gym.
   - *Location only*: listed and shown on the map, but not bookable.
3. **Photos**: upload a JPEG, PNG or WebP (up to 5 MB) on the facility page. Use photos you took yourself or have permission to use. Don't copy images from SRM's or other websites. Alternatively, put files in `public/images/facilities/` and enter `/images/facilities/<file>` as the image URL.
4. Untick **Mark as demonstration data** once a facility is real, and deactivate or delete the demo ones. Deleting is only possible when a facility has no booking history; otherwise, deactivate it.

## Scanning booking passes

Students check in by showing their booking's QR pass. Open **Scan passes**, press **Start camera** and scan the pass. You can also take a photo of it or type the code. Check the name shown matches the student in front of you, then press **Check in**. When they leave, scan the same pass and press **Check out**. SPACIO only offers the action that's valid right now, and explains why when neither is: too early, missed, cancelled or already finished. The live camera needs `https://` or `localhost`; over plain `http://` on a phone, use the photo option. See [QR.md](QR.md).

## Check-in log

The **Overview** page has a **Check-in log** beside the occupancy table. It shows who checked in or out, where (space, seat, building and floor) and when, and it updates live as students scan. Entries from `seed_demo_activity.sql` carry a **demo** tag; those are fictional students, not real people. The log is built from booking records, so it always matches the real booking state. Only admins can read it.

## Seats

**Facilities → Seats**: generate rows and columns, then select seats to mark them *maintenance* or *disabled*, rename or move one, or remove them. Seats with booking history can't be removed, so disable them instead. Dots show seats that are booked or checked in right now.

## Reservations

Search by student email, name, facility, seat or booking ID, and filter by status (*No-shows* shows missed check-ins). **Cancel** releases the seat or place. The student sees "cancelled by staff" with your reason. **Run sweep now** immediately marks overdue bookings as no-show or ended. This also happens automatically.

## Entrance QR codes

See [QR.md](QR.md). In short: set `NEXT_PUBLIC_SITE_URL` to the live address, open **QR codes → Print sheet**, and place each card at its entrance. **Replace** immediately invalidates a code, for example if it's been photographed and misused.
