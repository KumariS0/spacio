# Environment variables

Copy `.env.example` to `.env.local` for development. Set the same values in your host's settings for production.

Variables starting with `NEXT_PUBLIC_` are included in the browser bundle. **Never** give a secret that prefix.

| Variable | Required | Where it's used | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server | Safe to expose; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server only** | OTP rate limiting, account deletion, scripts, cron route. Bypasses RLS: keep it secret |
| `SUPABASE_DB_URL` | For `npm run db:push` | **Server only, local** | Session pooler connection string with your database password. Only the setup script uses it; don't add it to your host |
| `ALLOWED_EMAIL_DOMAINS` | Yes | Server | Comma-separated, exact match (no subdomains). Default `srmist.edu.in` |
| `NEXT_PUBLIC_OTP_LENGTH` | Yes | Browser + server | Must match Supabase's Email OTP length (6) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Both | Public address. **Printed QR codes contain it**, so set it before printing |
| `NEXT_PUBLIC_CAMPUS_NAME` / `_SHORT_NAME` | No | Both | Display text |
| `NEXT_PUBLIC_CAMPUS_TZ` | No | Both | Default `Asia/Kolkata`. The database uses `app_settings.timezone` |
| `NEXT_PUBLIC_MAP_CENTER_LAT` / `_LNG` / `_ZOOM` | No | Browser | Leave blank unless verified. Enables the street-map tab |
| `CRON_SECRET` | Recommended | Server | Bearer token for `GET /api/cron/sweep` |
| `OPENROUTER_API_KEY` | For Nook | **Server only** | From [openrouter.ai/keys](https://openrouter.ai/keys). Without it the chat button is hidden in production |
| `OPENROUTER_MODEL` | No | Server | Default `openrouter/auto`. Any OpenRouter model id, e.g. a Gemini model |
| `ASSISTANT_RATE_LIMIT` / `ASSISTANT_RATE_WINDOW_SECONDS` | No | Server | Messages per student per window (default 20 per 600 s) |
| `ASSISTANT_GUEST_MODE` | No | Server | `on` (default): visitors who aren't signed in can ask general questions on the landing page. `off`: sign-in required |
| `ASSISTANT_GUEST_RATE_LIMIT` / `ASSISTANT_GUEST_GLOBAL_LIMIT` | No | Server | Guest messages per IP per window (default 8) and per server per hour (default 150) |

Test-only: `E2E_SUPABASE=1` runs the live browser suite, `PW_CHANNEL` picks the browser, and `RACE_USERS` sets the number of parallel users in `race-test`.
