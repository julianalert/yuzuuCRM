-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Lead Finder
-- Replaces Apollo/TAM B2B discovery with Google Maps local lead finder
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend workspaces with brand profile + lead finder config ────────────────

alter table workspaces
  add column if not exists offer_description    text,
  add column if not exists brand_website_url    text,
  add column if not exists icp_category         text,
  add column if not exists icp_city             text,
  add column if not exists icp_country          text,
  add column if not exists enrichment_credits   int not null default 3;

-- ── lead_searches — one row per search session ───────────────────────────────

create table if not exists lead_searches (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  user_id          uuid references users(id) on delete set null,
  category         text,
  city             text,
  country          text,
  offer_description text,
  status           text not null default 'pending',  -- pending | running | done | error
  result_count     int,
  apify_run_id     text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_lead_searches_workspace
  on lead_searches (workspace_id, created_at desc);

-- ── leads — individual business records from Google Maps ─────────────────────

create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  search_id        uuid not null references lead_searches(id) on delete cascade,
  workspace_id     uuid not null references workspaces(id) on delete cascade,

  -- Raw GMB data from Apify
  name             text,
  category         text,
  address          text,
  phone            text,
  website          text,
  rating           numeric,
  review_count     int,
  google_maps_url  text,
  place_id         text,

  -- Surface score (computed from raw GMB, no enrichment needed)
  surface_score    int,

  -- Enrichment
  enrichment_status text not null default 'none',  -- none | loading | done | error
  enriched_at      timestamptz,

  -- Enriched data
  website_tech         jsonb,
  website_quality_score int,
  has_booking_system   boolean,
  has_social_presence  boolean,
  social_links         jsonb,
  review_sentiment     text,    -- positive | mixed | negative
  last_review_date     date,
  owner_response_rate  int,

  -- AI output
  opportunity_score  int,
  score_reasoning    text,
  outreach_email     text,

  created_at         timestamptz not null default now()
);

create index if not exists idx_leads_search
  on leads (search_id, surface_score desc);

create index if not exists idx_leads_workspace
  on leads (workspace_id, created_at desc);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table lead_searches enable row level security;

create policy "Workspace members can view lead searches"
  on lead_searches for select
  using (workspace_id = get_user_workspace_id());

create policy "Workspace members can insert lead searches"
  on lead_searches for insert
  with check (workspace_id = get_user_workspace_id());

create policy "Workspace members can update lead searches"
  on lead_searches for update
  using (workspace_id = get_user_workspace_id());

alter table leads enable row level security;

create policy "Workspace members can view leads"
  on leads for select
  using (workspace_id = get_user_workspace_id());

create policy "Workspace members can insert leads"
  on leads for insert
  with check (workspace_id = get_user_workspace_id());

create policy "Workspace members can update leads"
  on leads for update
  using (workspace_id = get_user_workspace_id());

create policy "Workspace members can delete leads"
  on leads for delete
  using (workspace_id = get_user_workspace_id());
