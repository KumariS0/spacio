# Connecting Supabase

These steps take a fresh Supabase project to a working SPACIO. They take about 20 minutes. Everything below uses the Supabase dashboard; the [Supabase CLI](https://supabase.com/docs/guides/cli) works too (`supabase link` then `supabase db push`).

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick a region close to India (e.g. Mumbai).
2. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the **service_role** key into `.env.local` (see [ENV.md](ENV.md)).

## 2. Create the database

**Quickest:** put the **Session pooler** connection string (top bar **Connect**) into `SUPABASE_DB_URL` in `.env.local`, with your database password in place of `[YOUR-PASSWORD]`, then run:

```bash
npm run db:push -- --dry-run                 # see what will run
npm run db:push -- --seed --demo-activity    # migrations + demo spaces + fictional check-in log
```

Each migration runs in a transaction and is recorded in `supabase_migrations.schema_migrations` (the Supabase CLI's table), so running it again only applies new files. Leave off `--seed` / `--demo-activity` if you don't want demo data.

**Or by hand:** in **SQL Editor**, run each file in order, pasting the whole file each time:

1. `supabase/migrations/20261105000001_core_schema.sql`
2. `supabase/migrations/20261105000002_functions.sql`
3. `supabase/migrations/20261105000003_security.sql`
4. `supabase/migrations/20261105000004_platform.sql`. This sets up Realtime, Storage and pg_cron. Each part is skipped safely if that feature isn't available.
5. `supabase/migrations/20261105000005_assistant.sql`. This is Nook's rate limit.
6. `supabase/migrations/20261105000006_activity_log.sql`. This powers the admin check-in log.
7. `supabase/migrations/20261106000007_booking_pass.sql`. This adds a QR pass to every booking, plus the admin pass scanner.
8. `supabase/seed.sql`. This is optional demonstration data. Every row is marked `is_demo`.
9. `supabase/seed_demo_activity.sql`. This is optional. It adds eight **fictional** students, with `@demo.spacio.invalid` addresses, and a few hours of check-ins and check-outs, so the admin check-in log isn't empty. Run it again any time to refresh the times. The bottom of the file shows how to remove it.

Check: **Table Editor** should show `facilities` with 6 rows, and **Database → Publications → supabase_realtime** should include `facility_live`.

## 3. Email sign-in with a 6-digit code

1. **Authentication → Sign In / Providers → Email**: keep **Email** enabled. Set **Email OTP Length** to `6`, matching `NEXT_PUBLIC_OTP_LENGTH`, and **Email OTP Expiration** to `600` seconds.
2. **Authentication → Emails → Templates → Magic Link**: replace the body so the email contains the code:
   ```html
   <h2>Your SPACIO sign-in code</h2>
   <p>Enter this code to sign in: <strong style="font-size:24px;letter-spacing:4px">{{ .Token }}</strong></p>
   <p>It expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
   ```
   Do the same for the **Confirm signup** template, since first-time users receive that one.
3. **SMTP**: Supabase's built-in email is heavily rate-limited, to a few emails per hour, and is only meant for testing. Under **Authentication → Emails → SMTP Settings**, add a real provider such as Resend, Brevo or Amazon SES before students use it.
4. **Authentication → URL Configuration**: set **Site URL** to your deployed address. Add `http://localhost:3000/**` and `https://YOUR-DOMAIN/**` to **Redirect URLs**.

## 4. Only allow college emails (backend enforcement)

The website already rejects other domains, but the database must enforce it too:

**Authentication → Hooks → Before User Created** → **Postgres function** → `public.hook_before_user_created` → enable.

Allowed domains live in the `allowed_email_domains` table (seeded with `srmist.edu.in`). Keep it in sync with `ALLOWED_EMAIL_DOMAINS`.

## 5. Storage

The migration creates a public `facility-images` bucket (5 MB, JPEG/PNG/WebP) that only admins can write to. Check it under **Storage**. If it's missing, create it with those settings.

## 6. Make yourself an admin

1. Run `npm run dev` and sign in once with your college email.
2. Run `npm run make-admin -- yourname@srmist.edu.in`, then refresh the page. An **Admin** link appears.

## 7. Verify

- Sign in on a phone with a college email. You should get a code, then the onboarding screen.
- A Gmail address should be rejected on the website. If you call the API directly, the sign-up hook rejects it.
- Book a seat, then open **Admin → QR codes**, open the facility's link on your phone, and check in and out.
- Optionally run `npm run race-test` against a **non-production** project to confirm concurrent bookings behave. It creates and deletes temporary users. It needs password sign-in left enabled on the Email provider, which the website itself never uses.
