# Nook, the SPACIO assistant

Nook is SPACIO's chat assistant, opened from the round button at the bottom-right. It works in two modes:

- **Students (signed in):** on every student page. It answers from live data: "Where can I study right now?", "Is the gym busy?", "When is my next booking?".
- **Guests (not signed in):** on the landing page. It answers general questions only ("How does booking work?", "Who can sign in?") and suggests signing in for anything else. Guest mode works with **only** an OpenRouter key, before Supabase is connected.

## Setup

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys) and add credits, or choose a free model.
2. Open `.env.local` in the project folder (it's already there and git-ignored) and paste the key after `OPENROUTER_API_KEY=`, with no quotes or spaces. On a host such as Vercel, add it under the project's environment variables instead. Don't paste keys into chats, issues or commits.
3. Restart `npm run dev`. The chat button appears on the landing page straight away, and on student pages once Supabase is connected.

**Choosing a model:** OpenRouter gives one key access to many providers. Leave `openrouter/auto` to let OpenRouter choose, or pin a model from [openrouter.ai/models](https://openrouter.ai/models). For example, search "gemini" to use a Google Gemini model. Changing models needs no code changes.

## How it works

- The browser sends the conversation to `POST /api/assistant`. Cross-site requests are rejected.
- **Signed-in students:** the server checks the account is verified and on an allowed domain, and applies a per-student rate limit stored in Postgres (`assistant_take_quota`; no message text is stored). It then builds a system prompt from **live SPACIO data**: active spaces, today's hours, current availability, and the caller's own upcoming and recent bookings. It reads this data with the student's own session, so Row Level Security applies and no other student's data can appear in it.
- **Guests:** the system prompt holds only general instructions (how booking, check-in and sign-in work). No spaces, availability or bookings are included, so nothing private can leak and Nook is told not to guess them. Guests are limited per IP address (`ASSISTANT_GUEST_RATE_LIMIT` per `ASSISTANT_RATE_WINDOW_SECONDS`, default 8 per 10 minutes) and by an hourly cap for the whole server (`ASSISTANT_GUEST_GLOBAL_LIMIT`, default 150), to protect your credits. These limits are kept in memory: they reset on restart and each serverless instance counts separately. Set `ASSISTANT_GUEST_MODE=off` to require sign-in.
- It calls OpenRouter's chat completions API with streaming and passes the text back to the browser as it arrives.
- The API key is only read on the server and is never sent to the browser.

## Limits by design

- Nook **cannot** book, cancel, check in or check out. It explains the steps and links to the right page. The prompt forbids it from claiming an action was done.
- It is told to use only the data provided and to say when it doesn't know something, such as walking directions or staff contacts, rather than invent it.
- Answers can still be wrong, and the panel says so. Availability is a snapshot from when the question was asked.
- Conversations are kept only in the browser tab (`sessionStorage`) and disappear when it closes.

## Troubleshooting

| Message | Fix |
| --- | --- |
| "Nook isn't set up yet" | `OPENROUTER_API_KEY` missing; restart after adding |
| "API key was rejected" | Wrong or revoked key |
| "out of credits" | Add credits on OpenRouter or pick a free model |
| "configured model … isn't available" | Check `OPENROUTER_MODEL` against openrouter.ai/models |
| "You've sent a lot of messages" | Per-student limit; tune `ASSISTANT_RATE_LIMIT` |
| "Nook has a small limit for visitors" | Guest limit; tune `ASSISTANT_GUEST_RATE_LIMIT` / `ASSISTANT_GUEST_GLOBAL_LIMIT`, or sign in |
| No chat button on the landing page | No key, or `ASSISTANT_GUEST_MODE=off`. In production, rebuild after changing environment variables |
