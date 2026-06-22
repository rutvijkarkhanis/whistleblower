# Deploying Whistleblower (Vercel free tier + your domain)

Total cost: **$0** (Vercel Hobby + Supabase Free + your own domain). You only pay
Anthropic for tokens you actually use.

---

## 1. Supabase (database + auth) — one-time

1. Create a project at [supabase.com](https://supabase.com) (Free tier).
2. **SQL Editor → New query**, then run each migration in order and click Run:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_seed.sql`
   - `supabase/migrations/0003_portals.sql`
3. **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
4. **Authentication → Providers → Email**: make sure Email is enabled.
   "Confirm email" can stay on; magic links work either way.

> The Free tier pauses a project after ~1 week of zero activity. Just open the
> dashboard to resume it, or upgrade later if that bites.

## 2. Push to GitHub

This repo is already on the `claude/epic-galileo-e7gp3a` branch. Merge it to
`main` (or point Vercel at the branch).

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import this GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave build settings default.
3. **Environment Variables** — add all of these (Production + Preview):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (secret) |
   | `LLM_PROVIDER` | `gemini` |
   | `GEMINI_API_KEY` | free key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
   | `ALLOWED_EMAILS` | `rutvij.karkhanis@gmail.com` (comma-separate if more) |

   > **AI provider is free by default (Gemini).** Get a key at
   > [Google AI Studio](https://aistudio.google.com/app/apikey) → "Create API key"
   > — no billing required. To use Claude instead, set `LLM_PROVIDER=anthropic`
   > and `ANTHROPIC_API_KEY=…` (paid); for Groq, `LLM_PROVIDER=groq` + `GROQ_API_KEY`.

4. **Deploy.** You'll get a `*.vercel.app` URL.

## 4. Your domain

1. Vercel → Project → **Settings → Domains → Add** → enter your domain
   (e.g. `apps.yourdomain.com` or the apex `yourdomain.com`).
2. Add the DNS record Vercel shows you at your registrar:
   - Subdomain → `CNAME` to `cname.vercel-dns.com`
   - Apex/root → `A` record to the IP Vercel gives you
3. HTTPS is provisioned automatically once DNS verifies (a few minutes).

## 5. Point Supabase auth at your domain (important for login)

Supabase must trust your domain or the magic-link redirect fails.

**Authentication → URL Configuration:**
- **Site URL**: `https://your-domain`
- **Redirect URLs**: add `https://your-domain/auth/callback`
  (also add `http://localhost:3000/auth/callback` for local dev)

## 6. Done — sign in

Visit your domain → you'll hit the login page → enter your email → click the
magic link in your inbox. Only emails in `ALLOWED_EMAILS` can get in.

---

## Free-tier notes

- **Function timeout is 60s on Hobby.** The app already works within this: it
  generates one content type per request and imports one URL per request
  (progressively), so nothing hits the cap. If you upgrade to Pro you can raise
  `maxDuration` and use the batch `/api/jobs/import` endpoint directly.
- **Local dev:** `cp .env.local.example .env.local`, fill it in, `npm run dev`.
- The outreach modules (LinkedIn DMs via Unipile, Gmail, Twilio, Apollo) are
  **not wired** and need no keys to deploy — leave those env vars blank.
