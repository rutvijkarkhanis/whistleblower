# CLAUDE.md — Whistleblower

Dubai job application & outreach automation tool, built for one operator: **Rutvij Karkhanis**.

## Operating rules (non-negotiable)

- **Always load Rutvij's profile context** into every Anthropic call. Never generate generic output. The profile lives in `src/lib/profile.ts` (`PROFILE_TEXT` / `SYSTEM_PREAMBLE`) and is mirrored in `supabase/migrations/0002_seed.sql`. Keep them in sync.
- **All Claude API calls use `model: "claude-sonnet-4-6"`** — defined once in `src/lib/anthropic.ts` (`MODEL`). Do not hardcode model strings elsewhere.
- **Supabase**: server-side client initialized with the **service role key for mutations** (`serviceClient()`), **anon key for client reads** (`anonClient()`). Both in `src/lib/supabase.ts`. Never import `serviceClient` into a browser bundle.
- **n8n** runs locally on port `5678`; the webhook base URL is configurable via `N8N_WEBHOOK_BASE_URL`.
- **Unipile, Gmail, Twilio, Apollo credentials live in `.env.local`** — never hardcode. See `.env.local.example`.
- **On every JD analysis, always extract Dubai/GCC relevance signals** and surface them in the fit score (`dubai_signals` + the `dubai_gcc` fit dimension). Enforced in `src/lib/jd.ts`.
- **Keep the UI minimal and fast** — this is a daily-use tool, not a portfolio piece.

## Stack

Next.js 14 (App Router) + TypeScript · Supabase (auth/db/storage) · Anthropic `claude-sonnet-4-6` · n8n · Unipile · Gmail API · Twilio · Tailwind.

## Module status

| Module | What | Status |
|---|---|---|
| 1 — JD Intelligence | paste/scrape JD → extract + fit score → `jobs` | ✅ built |
| 2 — Content Generation | cover letter, LinkedIn DMs, cold email seq, WhatsApp, interview STAR, salary script → `generated_content` | ✅ built |
| 3 — Outreach Automation | sequence builder, Unipile/Gmail/Twilio sends, `outreach_log`, reply webhooks | ⏳ schema ready; **paid APIs not wired — confirm before enabling** |
| 4 — Pipeline CRM | Kanban (drag between stages), per-job notes, follow-up reminders on dashboard | ✅ built |
| 5 — Analytics | reply rates, funnel, best variants | ⏳ pending |
| 6 — Dubai Intelligence | Apollo enrichment, visa heuristics, `salary_benchmarks` | ⏳ benchmarks seeded; **Apollo not wired — confirm before enabling** |

## Layout

```
src/lib/        profile, supabase, anthropic clients; jd (M1) + content (M2) logic; types
src/app/api/    jobs, jobs/[id], jobs/[id]/content, content/[id], scrape, reminders, reminders/[id]
src/app/        dashboard (page.tsx) + job detail (jobs/[id]/page.tsx)
supabase/migrations/  0001_init.sql (8 tables + reminders), 0002_seed.sql (profile + AED benchmarks)
```

## Setup

1. `npm install`
2. `cp .env.local.example .env.local` and fill Supabase + `ANTHROPIC_API_KEY`.
3. Apply migrations to your Supabase project (SQL editor or `supabase db push`).
4. `npm run dev`.

## Conventions

- Content types are the union in `src/lib/types.ts` (`CONTENT_TYPES`). Generated rows are versioned per `(job_id, type)`; manual edits set `edited = true`.
- API routes that call Anthropic set `runtime = "nodejs"` and a raised `maxDuration`.
- Tones: `executive | founder-to-founder | direct`.
