-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010: Always-on intent engine
--
-- - market_cells: cell-based coverage (query × geographic circle) with full
--   lifecycle (pending|scanning|partial|exhausted|needs_split|refreshing|error|dead)
--   and quadtree splitting via parent_cell_id.
-- - lead_signals: detected intent signals per lead (one row per type per lead).
-- - lead_blocklist: place_ids the workspace has hidden, prevents re-discovery.
-- - geocode_cache: cached Nominatim responses (1 req/s public limit).
-- - leads.relevance, intent_score, last_refreshed_at, outreach_email_stale, archived_at.
-- - workspaces.next_run_at, last_digest_sent_at, apify_spend_cents_month,
--   apify_spend_month_key, timezone, tam_status, onboarding_completed_at,
--   last_login_at.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── leads extensions ─────────────────────────────────────────────────────────

alter table leads
  add column if not exists relevance              text not null default 'cold',
  add column if not exists intent_score           int  not null default 0,
  add column if not exists last_refreshed_at      timestamptz,
  add column if not exists outreach_email_stale   boolean not null default false,
  add column if not exists archived_at            timestamptz;

do $$ begin
  alter table leads add constraint leads_relevance_check
    check (relevance in ('hot', 'warm', 'cold'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_leads_workspace_relevance
  on leads (workspace_id, relevance, intent_score desc)
  where archived_at is null;

create index if not exists idx_leads_workspace_refresh
  on leads (workspace_id, last_refreshed_at)
  where archived_at is null;

-- ── workspaces extensions ────────────────────────────────────────────────────

alter table workspaces
  add column if not exists next_run_at              timestamptz default now(),
  add column if not exists last_digest_sent_at      timestamptz,
  add column if not exists apify_spend_cents_month  int  not null default 0,
  add column if not exists apify_spend_month_key    text,
  add column if not exists timezone                 text not null default 'UTC',
  add column if not exists tam_status               text not null default 'active',
  add column if not exists onboarding_completed_at  timestamptz,
  add column if not exists last_login_at            timestamptz;

do $$ begin
  alter table workspaces add constraint workspaces_tam_status_check
    check (tam_status in ('active', 'fully_scanned', 'expired'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_workspaces_next_run_at
  on workspaces (next_run_at)
  where next_run_at is not null;

-- Backfill onboarding_completed_at from any existing workspaces that have
-- finished onboarding (offer_description set) so they don't get treated
-- as fresh trials by the trial-burst code path.
update workspaces
  set onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
  where offer_description is not null;

-- Ensure every existing onboarded workspace is immediately picked up by
-- the new tick — without this they'd sit with next_run_at = NULL forever
-- after the column add (default applies only to new rows).
update workspaces
  set next_run_at = now()
  where next_run_at is null
    and offer_description is not null
    and icp_niches is not null
    and array_length(icp_niches, 1) > 0;

-- ── market_cells ─────────────────────────────────────────────────────────────

create table if not exists market_cells (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  query              text not null,
  lat                numeric(9, 6) not null,
  lng                numeric(9, 6) not null,
  radius_km          numeric(6, 2) not null,
  priority           int  not null default 1,
  status             text not null default 'pending',
  parent_cell_id     uuid references market_cells(id) on delete cascade,
  scans_run          int  not null default 0,
  scraped_count      int  not null default 0,
  unique_count       int  not null default 0,
  last_dedup_ratio   numeric(5, 4),
  last_scanned_at    timestamptz,
  exhausted_at       timestamptz,
  retry_count        int  not null default 0,
  next_retry_at      timestamptz,
  last_error         text,
  created_at         timestamptz not null default now()
);

do $$ begin
  alter table market_cells add constraint market_cells_status_check
    check (status in ('pending', 'scanning', 'partial', 'exhausted',
                      'needs_split', 'refreshing', 'error', 'dead'));
exception when duplicate_object then null;
end $$;

create unique index if not exists idx_market_cells_unique
  on market_cells (workspace_id, query, lat, lng, radius_km);

-- The hot path: pick the next claimable cell for a workspace.
create index if not exists idx_market_cells_pick
  on market_cells (workspace_id, status, priority, last_scanned_at nulls first)
  where status in ('pending', 'partial');

create index if not exists idx_market_cells_retry
  on market_cells (next_retry_at)
  where status = 'error';

alter table market_cells enable row level security;

create policy "Workspace members can view market cells"
  on market_cells for select
  using (workspace_id = get_user_workspace_id());

-- ── lead_signals ─────────────────────────────────────────────────────────────

create table if not exists lead_signals (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  type          text not null,
  severity      int  not null default 50,
  evidence      jsonb,
  detected_at   timestamptz not null default now()
);

create unique index if not exists idx_lead_signals_unique
  on lead_signals (lead_id, type);

create index if not exists idx_lead_signals_workspace
  on lead_signals (workspace_id, detected_at desc);

alter table lead_signals enable row level security;

create policy "Workspace members can view lead signals"
  on lead_signals for select
  using (workspace_id = get_user_workspace_id());

-- ── lead_blocklist ───────────────────────────────────────────────────────────
-- place_ids the workspace has explicitly hidden / deleted; prevents the
-- discovery loop from re-inserting them on subsequent scrapes.

create table if not exists lead_blocklist (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  place_id      text not null,
  reason        text,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, place_id)
);

alter table lead_blocklist enable row level security;

create policy "Workspace members can view their blocklist"
  on lead_blocklist for select
  using (workspace_id = get_user_workspace_id());

create policy "Workspace members can manage their blocklist"
  on lead_blocklist for all
  using (workspace_id = get_user_workspace_id())
  with check (workspace_id = get_user_workspace_id());

-- ── geocode_cache ────────────────────────────────────────────────────────────
-- Nominatim public endpoint is rate limited (1 req/s) and asks for an
-- identifying User-Agent. We cache every successful geocode forever.

create table if not exists geocode_cache (
  query         text primary key,  -- lowercased input
  lat           numeric(9, 6),
  lng           numeric(9, 6),
  admin_level   text,              -- city | region | country | other
  country_code  text,
  bbox_north    numeric(9, 6),
  bbox_south    numeric(9, 6),
  bbox_east     numeric(9, 6),
  bbox_west     numeric(9, 6),
  raw           jsonb,
  cached_at     timestamptz not null default now()
);

-- RLS on with NO policies → service role (which bypasses RLS) has full
-- access, every other client (anon / authenticated) is blocked.
-- The cell-planner only ever runs server-side with the service role.
alter table geocode_cache enable row level security;

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Surface lead_signals + market_cells progress to the UI live.

do $$ begin
  alter publication supabase_realtime add table lead_signals;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table market_cells;
exception when duplicate_object then null;
end $$;

-- ── Atomic claim functions ───────────────────────────────────────────────────
-- These exist so concurrent cron invocations cannot pick the same workspace
-- or the same cell. SELECT FOR UPDATE SKIP LOCKED is the only race-safe
-- primitive Postgres gives us; PostgREST/Supabase's UPDATE-with-WHERE does
-- not translate to SKIP LOCKED on its own.

-- Returns up to `p_limit` workspaces whose next_run_at <= now() and which
-- still have monthly budget available, sets their next_run_at to a
-- placeholder (now + 5 min) so even if the runner crashes the workspace
-- will become re-claimable in 5 minutes.
create or replace function claim_next_workspaces(p_limit int)
returns setof workspaces
language plpgsql
as $$
begin
  return query
  with due as (
    select id
    from workspaces
    where coalesce(next_run_at, created_at) <= now()
      and subscription_status not in ('canceled')
      and offer_description is not null
      and icp_niches is not null
      and array_length(icp_niches, 1) > 0
      and icp_city is not null
    order by next_run_at asc nulls first
    limit p_limit
    for update skip locked
  )
  update workspaces w
     set next_run_at = now() + interval '5 minutes'
    from due
   where w.id = due.id
  returning w.*;
end;
$$;

-- Claim the next workable cell for a workspace. Picks pending or partial
-- cells ordered by priority, then by oldest last_scanned_at. Returns NULL
-- if nothing is workable.
create or replace function claim_next_cell(p_workspace_id uuid)
returns setof market_cells
language plpgsql
as $$
begin
  return query
  with picked as (
    select id
    from market_cells
    where workspace_id = p_workspace_id
      and status in ('pending', 'partial')
    order by priority asc, last_scanned_at asc nulls first
    limit 1
    for update skip locked
  )
  update market_cells c
     set status = 'scanning',
         scans_run = c.scans_run + 1
    from picked
   where c.id = picked.id
  returning c.*;
end;
$$;

grant execute on function claim_next_workspaces(int) to service_role;
grant execute on function claim_next_cell(uuid)      to service_role;
