-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011: Tier 1 lead actionability
--
-- Contact enrichment + existing-agency detection + per-lead snapshot reports.
--
-- - leads.owner_* — decision-maker contact info from website scrape + Hunter
-- - leads.has_existing_agency + agency_confidence + agency_evidence
-- - workspaces.contact_spend_* and report_spend_* — per-month budgets
-- - lead_reports — generated 1-page snapshots, publicly shareable via token
-- ─────────────────────────────────────────────────────────────────────────────

-- ── leads: contact columns ───────────────────────────────────────────────────

alter table leads
  add column if not exists owner_name           text,
  add column if not exists owner_email          text,
  add column if not exists owner_email_status   text,
  add column if not exists owner_linkedin_url   text,
  add column if not exists contact_source       text,
  add column if not exists contact_enriched_at  timestamptz;

do $$ begin
  alter table leads add constraint leads_owner_email_status_check
    check (owner_email_status is null or owner_email_status in ('valid','risky','invalid','unverifiable','unknown'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table leads add constraint leads_contact_source_check
    check (contact_source is null or contact_source in ('website_scrape','hunter','manual'));
exception when duplicate_object then null;
end $$;

-- "Leads I can outreach to right now" — used by the UI's outreach filters
-- and (later) by the multi-step sequencer.
create index if not exists idx_leads_workspace_owner_email
  on leads (workspace_id, owner_email)
  where owner_email is not null and archived_at is null;

-- ── leads: existing-agency columns ───────────────────────────────────────────

alter table leads
  add column if not exists has_existing_agency         boolean not null default false,
  add column if not exists existing_agency_confidence  text    not null default 'none',
  add column if not exists existing_agency_evidence    jsonb;

do $$ begin
  alter table leads add constraint leads_existing_agency_confidence_check
    check (existing_agency_confidence in ('none','low','medium','high'));
exception when duplicate_object then null;
end $$;

-- ── workspaces: contact + report monthly budgets ─────────────────────────────

alter table workspaces
  add column if not exists contact_spend_cents_month  int  not null default 0,
  add column if not exists contact_spend_month_key    text,
  add column if not exists report_spend_cents_month   int  not null default 0,
  add column if not exists report_spend_month_key     text;

-- ── lead_reports ─────────────────────────────────────────────────────────────
-- One row per snapshot generation. The structured `payload` is the source of
-- truth; HTML and PDF renderers consume it. `public_token` powers the
-- shareable /r/<token> link the agency pastes into outreach.

create table if not exists lead_reports (
  id                            uuid primary key default gen_random_uuid(),
  lead_id                       uuid not null references leads(id) on delete cascade,
  workspace_id                  uuid not null references workspaces(id) on delete cascade,
  public_token                  text not null unique,
  payload                       jsonb not null,
  model                         text not null,
  is_stale                      boolean not null default false,
  regenerated_for_profile_hash  text,
  generated_at                  timestamptz not null default now()
);

create unique index if not exists idx_lead_reports_active
  on lead_reports (lead_id)
  where is_stale = false;

create index if not exists idx_lead_reports_workspace
  on lead_reports (workspace_id, generated_at desc);

alter table lead_reports enable row level security;

create policy "Workspace members can view their reports"
  on lead_reports for select
  using (workspace_id = get_user_workspace_id());

-- Public route /r/<token> reads via service role; no public-anon policy needed.

-- Realtime: reports stream in as they're generated so the lead profile
-- can transition from "generating…" to rendered without polling.
do $$ begin
  alter publication supabase_realtime add table lead_reports;
exception when duplicate_object then null;
end $$;
