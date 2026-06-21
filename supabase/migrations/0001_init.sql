-- Whistleblower schema: Dubai job application & outreach automation
-- Single-user tool (Rutvij). RLS kept permissive; mutations go through the
-- server using the service role key, client reads use the anon key.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: the operator's resume context, pre-loaded into every AI call
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  resume_json jsonb,
  raw_resume_text text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- jobs: a parsed JD + computed fit score (Module 1)
-- ---------------------------------------------------------------------------
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company text,
  role_title text,
  seniority text,
  jd_text text,
  jd_url text,
  fit_score int check (fit_score between 0 and 100),
  fit_breakdown_json jsonb,        -- { gtm, founders_office, dubai_gcc, industry, rationale }
  keywords text[],                  -- ATS keywords
  must_haves text[],
  nice_to_haves text[],
  red_flags text[],
  dubai_signals text[],             -- Dubai/GCC relevance signals (always extracted)
  stage text not null default 'saved'
    check (stage in ('saved','applied','interviewing','offer','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_stage_idx on jobs (stage);
create index if not exists jobs_created_idx on jobs (created_at desc);

-- ---------------------------------------------------------------------------
-- generated_content: AI outputs linked to a job (Module 2)
-- type ∈ cover_letter | linkedin_dm_hm | linkedin_dm_recruiter |
--        cold_email_1 | cold_email_2 | cold_email_3 | whatsapp |
--        interview_qa | salary_script
-- versioned + editable
-- ---------------------------------------------------------------------------
create table if not exists generated_content (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  type text not null,
  content text,
  tone text,                        -- executive | founder-to-founder | direct
  version int not null default 1,
  edited boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists generated_content_job_idx on generated_content (job_id);
create index if not exists generated_content_type_idx on generated_content (job_id, type, version desc);

-- ---------------------------------------------------------------------------
-- contacts: people at a target company (Module 3/6)
-- ---------------------------------------------------------------------------
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  name text,
  title text,
  linkedin_url text,
  email text,
  whatsapp text,
  created_at timestamptz not null default now()
);

create index if not exists contacts_job_idx on contacts (job_id);

-- ---------------------------------------------------------------------------
-- sequences: outreach sequence definitions (Module 3)
-- ---------------------------------------------------------------------------
create table if not exists sequences (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  steps_json jsonb,                 -- [{ channel, content_type, delay_hours, stop_on_reply }]
  status text not null default 'draft'
    check (status in ('draft','active','paused','completed')),
  created_at timestamptz not null default now()
);

create index if not exists sequences_job_idx on sequences (job_id);

-- ---------------------------------------------------------------------------
-- outreach_log: every send + its status (Module 3)
-- ---------------------------------------------------------------------------
create table if not exists outreach_log (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  channel text not null check (channel in ('linkedin','email','whatsapp')),
  message text,
  status text not null default 'sent'
    check (status in ('sent','delivered','replied','bounced','failed')),
  sent_at timestamptz not null default now(),
  replied_at timestamptz
);

create index if not exists outreach_log_job_idx on outreach_log (job_id);
create index if not exists outreach_log_channel_idx on outreach_log (channel);

-- ---------------------------------------------------------------------------
-- salary_benchmarks: Dubai market ranges by role type + seniority (Module 6)
-- ---------------------------------------------------------------------------
create table if not exists salary_benchmarks (
  id uuid primary key default gen_random_uuid(),
  role_type text not null,
  seniority text not null,
  min_aed int not null,
  max_aed int not null,
  notes text
);

create index if not exists salary_benchmarks_role_idx on salary_benchmarks (role_type, seniority);

-- ---------------------------------------------------------------------------
-- follow_up_reminders: surfaced on the dashboard (Module 4)
-- ---------------------------------------------------------------------------
create table if not exists follow_up_reminders (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  due_at timestamptz not null,
  note text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reminders_due_idx on follow_up_reminders (due_at) where not done;

-- keep updated_at fresh on jobs
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_set_updated_at on jobs;
create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function set_updated_at();
