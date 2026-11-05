# Deploying

SPACIO is a standard Next.js app. Vercel is the simplest host, and these steps assume it. Any Node 20+ host that runs `next build && next start` also works.

1. Push the repository to GitHub and **Import** it in Vercel.
2. **Settings → Environment Variables**: add everything from [ENV.md](ENV.md). Set `NEXT_PUBLIC_SITE_URL` to the production address, e.g. `https://spacio.vercel.app`.
3. Deploy. Then in Supabase:
   - **Authentication → URL Configuration**: set **Site URL** to that address and add `https://YOUR-DOMAIN/**` to **Redirect URLs**.
4. Print the QR codes **after** the final address is set, because the address is inside each code.

## Scheduled clean-up

Overdue bookings are settled in three ways, any one of which is enough:
1. **pg_cron** runs `sweep_reservations()` every minute, if the extension was available when the migrations ran (check **Database → Cron Jobs**).
2. Every booking, scan and bookings-page load runs the sweep first.
3. `GET /api/cron/sweep` with `Authorization: Bearer $CRON_SECRET` can be called from any scheduler, such as Vercel Cron, GitHub Actions or cron-job.org.

To use Vercel Cron, add a `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/sweep", "schedule": "*/5 * * * *" }] }
```
Vercel sends `CRON_SECRET` automatically when it's set as an environment variable. Hobby plans only allow daily schedules, so rely on pg_cron there.

## Checklist before students use it

- [ ] Real SMTP provider configured, because Supabase's default email is rate-limited
- [ ] Before User Created hook enabled
- [ ] Demo facilities replaced or deactivated, with real photos uploaded
- [ ] At least one admin granted
- [ ] QR codes printed from the production address
- [ ] `OPENROUTER_API_KEY` set if you want Nook
