-- Seed data: Rutvij's profile + Dubai salary benchmarks

-- ---------------------------------------------------------------------------
-- Profile (single operator). The app also keeps a hardcoded copy in
-- src/lib/profile.ts so AI calls never depend on a DB round-trip, but we
-- store it here so it can be edited/extended later.
-- ---------------------------------------------------------------------------
insert into profiles (resume_json, raw_resume_text)
select
  '{
    "name": "Rutvij Karkhanis",
    "headline": "Founder''s Office operator — 8 years experience",
    "target_roles": ["Chief of Staff", "C-suite", "Founder''s Office"],
    "target_market": "Dubai / GCC",
    "experience": [
      {
        "title": "AGM",
        "company": "Alex Panels & Black Cobra Group",
        "context": "600 Cr ARR building materials business",
        "highlights": [
          "Built INR 3.82Cr pipeline",
          "Led GCC/EU/UK expansion",
          "Conducted in-person lab evaluation in Dubai",
          "Unlocked ~50% cost recovery via MAI scheme",
          "Developed Ghana market in 2 weeks"
        ]
      },
      {
        "title": "Founder''s Office",
        "company": "Accacia.ai",
        "context": "climate tech",
        "highlights": [
          "Built full GTM stack",
          "Set up Zoho CRM",
          "Built US outbound pipeline"
        ]
      },
      {
        "title": "Co-founder",
        "company": "HypeBoxed",
        "highlights": ["Bootstrapped INR 0 to INR 25L"]
      },
      {
        "title": "Co-founder",
        "company": "Career Taxi"
      }
    ],
    "projects": [
      "Built AI voice agent on n8n + ElevenLabs + Twilio",
      "Hosts The GTMer Show podcast"
    ],
    "strengths": ["GTM", "Founder''s Office ops", "GCC/Dubai market", "outbound pipeline", "building materials / climate tech"]
  }'::jsonb,
  'Rutvij Karkhanis — Founder''s Office operator, 8 years experience. Last role: AGM at Alex Panels & Black Cobra Group (600 Cr ARR building materials business) — built INR 3.82Cr pipeline, led GCC/EU/UK expansion, conducted in-person lab evaluation in Dubai, unlocked ~50% cost recovery via MAI scheme, developed Ghana market in 2 weeks. Before that: Founder''s Office at Accacia.ai (climate tech) — built full GTM stack, Zoho CRM, US outbound pipeline. Co-founded HypeBoxed (INR 0 to INR 25L, bootstrapped) and Career Taxi. Built AI voice agent on n8n + ElevenLabs + Twilio. Podcast: The GTMer Show. Targeting Chief of Staff / C-suite / Founder''s Office roles in Dubai.'
where not exists (select 1 from profiles);

-- ---------------------------------------------------------------------------
-- Dubai salary benchmarks (AED, annual total cash, indicative market ranges)
-- ---------------------------------------------------------------------------
insert into salary_benchmarks (role_type, seniority, min_aed, max_aed, notes) values
  ('Chief of Staff', 'Mid',        360000,  540000, 'Series A/B startup; reports to founder/CEO'),
  ('Chief of Staff', 'Senior',     540000,  840000, 'Growth-stage / scale-up; broad mandate'),
  ('Chief of Staff', 'Executive',  840000, 1200000, 'Large org / family office; cross-functional authority'),
  ('Head of Growth', 'Mid',        360000,  540000, 'Owns GTM motion for one region'),
  ('Head of Growth', 'Senior',     540000,  780000, 'Multi-region GTM, team ownership'),
  ('COO',            'Senior',     660000,  960000, 'SME / scale-up operations'),
  ('COO',            'Executive',  960000, 1500000, 'Mid-market to enterprise'),
  ('GM',             'Mid',        420000,  600000, 'Single business unit / market'),
  ('GM',             'Senior',     600000,  900000, 'P&L ownership, regional GM'),
  ('Founder''s Office', 'Mid',     300000,  480000, 'Early-stage; generalist operator'),
  ('Founder''s Office', 'Senior',  480000,  720000, 'Trusted #2; strategy + execution')
on conflict do nothing;
