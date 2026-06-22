-- Module 1+ : portal import — track where a job came from and its location.
alter table jobs add column if not exists source text;    -- LinkedIn | Indeed | Bayt | ...
alter table jobs add column if not exists location text;   -- extracted job location

create index if not exists jobs_source_idx on jobs (source);
