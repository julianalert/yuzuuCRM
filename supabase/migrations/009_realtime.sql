-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009: Enable Supabase Realtime on leads tables
--
-- Without this, postgres_changes subscriptions on the 'leads' and
-- 'lead_searches' tables never emit events, so the LeadFinderView
-- realtime channel receives nothing after the agent inserts rows.
-- ─────────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table lead_searches;
