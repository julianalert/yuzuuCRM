-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Onboarding v2
-- Adds multi-select service types and niches to the workspace profile
-- ─────────────────────────────────────────────────────────────────────────────

alter table workspaces
  add column if not exists icp_services  text[],   -- e.g. {seo,web,ads}
  add column if not exists icp_niches    text[];    -- e.g. {"Restaurants & Cafés","Automotive"}

-- icp_category (text) is kept for backward compat with lead_searches;
-- it is populated with icp_niches[1] on every profile save.
