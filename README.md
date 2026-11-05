# SPACIO

A website that lets students at SRM KTR find campus spaces, see live availability, reserve library seats or gym slots, and check in and out by scanning a QR code at the entrance.

> **Student project, not an official SRM service.** The bundled facilities, buildings and images are demonstration data, not verified SRM infrastructure. Replace them from the admin area before real use.

## What's inside

| Area | Pages |
| --- | --- |
| Public | Landing `/`, sign-in `/login` → `/verify` (6-digit email code) → `/onboarding`, `/logged-out` |
| Students | `/home`, `/explore` (search and filters), `/spaces/[slug]`, `/spaces/[slug]/book`, `/bookings` (+ history, details, confirmation), `/scan` (+ checked-in, check-out confirm), `/saved`, `/map`, `/profile` (+ edit), `/help` |
| Admins | `/admin` dashboard, facilities (create/edit/images/hours/amenities), seat editor, buildings, reservations, QR codes (+ print sheet), audit log |
| Assistant | **Nook**, a chat assistant (OpenRouter) that answers from live SPACIO data and the student's own bookings |

**How it stays correct:** every booking, check-in and check-out goes through Postgres functions. They validate the request and lock rows where needed. Exclusion constraints make double-booking impossible, even under concurrent requests. Row Level Security means students can only see their own bookings. Hiding a button is never the protection.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth email OTP, Realtime, Storage) · OpenRouter (Nook) · Vitest + PGlite · Playwright

## Run it locally

```bash
npm install
cp .env.example .env.local     # fill in values — see docs/ENV.md
npm run dev                    # http://localhost:3000
```

Without Supabase keys, the public pages still work and signed-in pages explain that setup is incomplete. `http://localhost:3000/dev/preview` shows the main components with sample data (development only).

To make it fully work, follow **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**. In short:
1. Create a Supabase project.
2. Apply `supabase/migrations/*` and `supabase/seed.sql`.
3. Set up the email code template and the sign-up hook.
4. Add the keys to `.env.local`.
5. Sign in once, then run `npm run make-admin -- you@srmist.edu.in`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint |
| `npm test` | Unit tests plus database tests (real migrations in embedded Postgres) |
| `npm run test:e2e` | Browser tests (uses installed Chrome; `E2E_SUPABASE=1` for the live suite) |
| `npm run db:push [-- --seed --demo-activity]` | Create or update the Supabase database from `supabase/migrations` (needs `SUPABASE_DB_URL`) |
| `npm run make-admin -- <email> [--revoke]` | Grant or revoke the admin role |
| `npm run race-test` | Concurrency check against a real (non-production) Supabase project |

## Docs

- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md): connect the backend step by step
- [docs/ENV.md](docs/ENV.md): every environment variable
- [docs/DATABASE.md](docs/DATABASE.md): tables, functions, security model
- [docs/ADMIN.md](docs/ADMIN.md): managing spaces, seats, photos, QR codes
- [docs/QR.md](docs/QR.md): how QR check-in works and its limits
- [docs/ASSISTANT.md](docs/ASSISTANT.md): Nook, the AI assistant
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): deploying to Vercel

## Project layout

```
src/app/            routes (public, (auth), (student), admin, api)
src/actions/        server actions (auth, bookings, scan, favourites, admin)
src/components/     UI, spaces, seats, booking, scan, map, admin, assistant
src/lib/            Supabase clients, data loaders, time/QR/occupancy helpers
supabase/           migrations + seed
tests/              unit + database tests      e2e/  Playwright specs
scripts/            db-push, make-admin, race-test
```
