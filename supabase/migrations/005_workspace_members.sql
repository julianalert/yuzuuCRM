-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — workspace_members join table (multi-workspace per user)
-- ─────────────────────────────────────────────────────────────────────────────
-- Keeps users.workspace_id as the "active" workspace (RLS still relies on it).
-- workspace_members is the source of truth for "which workspaces can I see?".

create table if not exists workspace_members (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  role          user_role   not null default 'owner',
  joined_at     timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

-- Backfill from existing users rows (idempotent via ON CONFLICT DO NOTHING)
insert into workspace_members (user_id, workspace_id, role, joined_at)
select id, workspace_id, role, created_at
from users
on conflict do nothing;

-- Index for fast "list workspaces for user" queries
create index if not exists workspace_members_user_id
  on workspace_members(user_id);

-- RLS
alter table workspace_members enable row level security;

-- Users can read their own memberships
create policy "workspace_members_select_own"
  on workspace_members for select
  using (user_id = auth.uid());

-- Service role can insert (used by API routes and signup flows)
-- (service role bypasses RLS by default; no explicit policy needed)
