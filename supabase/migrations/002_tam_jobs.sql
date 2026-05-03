-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — TAM Build Jobs + Schema additions for Step 2
-- ─────────────────────────────────────────────────────────────────────────────

-- ── workspaces additions ──────────────────────────────────────────────────────
alter table workspaces
  add column if not exists apollo_api_key      text,
  add column if not exists anthropic_api_key   text;

-- ── icps additions ────────────────────────────────────────────────────────────
alter table icps
  add column if not exists raw_description   text,
  add column if not exists extracted_params  jsonb,
  add column if not exists technologies      text[] not null default '{}',
  add column if not exists funding_stages    text[] not null default '{}',
  add column if not exists employee_ranges   text[] not null default '{}';

-- ── accounts additions ────────────────────────────────────────────────────────
alter table accounts
  add column if not exists ai_score_reason   text,
  add column if not exists technology_stack  text[] not null default '{}',
  add column if not exists funding_stage     text;

-- ── tam_build_jobs ────────────────────────────────────────────────────────────
create table if not exists tam_build_jobs (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid references workspaces(id) on delete cascade,
  icp_id                uuid references icps(id) on delete cascade,
  status                text default 'running'
                          check (status in ('running', 'complete', 'error')),
  step_finding_done     boolean default false,
  step_finding_count    int default 0,
  step_enriching_done   boolean default false,
  step_enriching_count  int default 0,
  step_scoring_done     boolean default false,
  step_scoring_count    int default 0,
  total_accounts        int default 0,
  error_message         text,
  started_at            timestamptz default now(),
  completed_at          timestamptz,
  created_at            timestamptz default now()
);

alter table tam_build_jobs enable row level security;

create policy "workspace members can view their jobs"
  on tam_build_jobs for select
  using (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

create policy "service role can manage jobs"
  on tam_build_jobs for all
  using (true)
  with check (true);
