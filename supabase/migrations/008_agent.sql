-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008: Autonomous Lead Agent
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend workspaces with cached search plan ────────────────────────────────

alter table workspaces
  add column if not exists agent_search_plan  jsonb,
  add column if not exists agent_profile_hash text;

-- ── agent_runs — one row per autonomous daily search execution ────────────────

create table if not exists agent_runs (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  search_query     text not null,
  location_query   text not null,
  fingerprint      text not null,
  leads_found      int  not null default 0,
  leads_enriched   int  not null default 0,
  status           text not null default 'done',  -- done | error | skipped
  error_message    text,
  ran_at           timestamptz not null default now()
);

create index if not exists idx_agent_runs_workspace
  on agent_runs (workspace_id, ran_at desc);

create index if not exists idx_agent_runs_fingerprint
  on agent_runs (workspace_id, fingerprint, ran_at desc);

-- ── Dedup: one business per workspace (belt-and-suspenders) ──────────────────

-- Only add the unique constraint if place_id is ever non-null;
-- existing data may have nulls so we use a partial unique index.
create unique index if not exists idx_leads_workspace_place_id
  on leads (workspace_id, place_id)
  where place_id is not null;

-- ── Add discovered_at for "New today" badge ───────────────────────────────────

alter table leads
  add column if not exists discovered_at timestamptz;

-- Backfill existing leads so the column is populated
update leads set discovered_at = created_at where discovered_at is null;

-- ── Row Level Security for agent_runs ────────────────────────────────────────

alter table agent_runs enable row level security;

create policy "Workspace members can view agent runs"
  on agent_runs for select
  using (workspace_id = get_user_workspace_id());
