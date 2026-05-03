-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — Pipeline AI scoring, billing fields, team invitations
-- ─────────────────────────────────────────────────────────────────────────────

-- Add Stripe + trial fields to workspaces (idempotent)
alter table workspaces
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists trial_warning_sent_at timestamptz,
  add column if not exists anthropic_api_key text;

-- Ensure subscription_status default is trialing
alter table workspaces
  alter column subscription_status set default 'trialing';

-- Add AI health scoring fields to deals
alter table deals
  add column if not exists ai_health_score int check (ai_health_score >= 0 and ai_health_score <= 100),
  add column if not exists ai_health_reason text,
  add column if not exists ai_health_factors jsonb,
  add column if not exists stall_detected_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists currency text not null default 'USD',
  add column if not exists last_activity_at timestamptz;

-- Add expires_at to invitations
alter table invitations
  add column if not exists expires_at timestamptz;

-- Backfill expires_at for existing pending invitations (7 days from created_at)
update invitations
  set expires_at = created_at + interval '7 days'
  where expires_at is null and status = 'pending';

-- Indexes for pipeline performance
create index if not exists deals_workspace_stage
  on deals(workspace_id, stage)
  where deleted_at is null;

create index if not exists deals_owner
  on deals(owner_id)
  where deleted_at is null;

create index if not exists deals_stall
  on deals(workspace_id, stall_detected_at)
  where stall_detected_at is not null;

-- Deal score queue table (for daily cron re-scoring)
create table if not exists deal_score_queue (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid references deals(id) on delete cascade,
  created_at timestamptz default now()
);

-- RLS for deal_score_queue
alter table deal_score_queue enable row level security;

create policy "workspace members can read score queue"
  on deal_score_queue for select
  using (
    exists (
      select 1 from deals d
      join users u on u.workspace_id = d.workspace_id
      where d.id = deal_score_queue.deal_id
        and u.id = auth.uid()
    )
  );

-- Enable RLS on deals if not already (idempotent)
alter table deals enable row level security;

-- Drop existing policies if they exist and recreate
do $$ begin
  drop policy if exists "workspace members can manage deals" on deals;
exception when undefined_object then null;
end $$;

create policy "workspace members can manage deals"
  on deals for all
  using (workspace_id = get_user_workspace_id())
  with check (workspace_id = get_user_workspace_id());

-- Enable RLS on activities if not already
alter table activities enable row level security;

do $$ begin
  drop policy if exists "workspace members can manage activities" on activities;
exception when undefined_object then null;
end $$;

create policy "workspace members can manage activities"
  on activities for all
  using (workspace_id = get_user_workspace_id())
  with check (workspace_id = get_user_workspace_id());
