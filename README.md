# Whistleblower 🕵️

A full-stack Dubai job-application & outreach engine for **Rutvij Karkhanis** — targeting Chief of Staff / C-suite / Founder's Office roles.

Built so far: **Module 1 (JD Intelligence)** and **Module 2 (Content Generation)**, on a schema that's ready for the outreach, CRM, analytics, and Dubai-intelligence modules.

## What it does today

- **Paste a JD or a URL** → scraped with cheerio → Claude (`claude-sonnet-4-6`) extracts role, seniority, must-haves, nice-to-haves, red flags, ATS keywords, and Dubai/GCC signals.
- **Auto fit score (0–100)** with a dimension breakdown — GTM, Founder's Office, Dubai/GCC, Industry — grounded in Rutvij's real track record.
- **One-click content generation**, per tone (executive / founder-to-founder / direct): cover letter, LinkedIn DM to hiring manager, LinkedIn DM to recruiter, a 3-step cold-email sequence, WhatsApp message, 5 likely interview questions + STAR answers, and a Dubai salary-negotiation script.
- **Regenerate or hand-edit** any output. Everything is versioned and stored.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill Supabase + ANTHROPIC_API_KEY
# apply supabase/migrations/*.sql to your project
npm run dev
```

## Stack

Next.js 14 · TypeScript · Tailwind · Supabase · Anthropic `claude-sonnet-4-6`. Outreach (n8n / Unipile / Gmail / Twilio) and enrichment (Apollo) are scaffolded but **not wired** — see `CLAUDE.md` for module status.

See `CLAUDE.md` for the operating rules and architecture.
