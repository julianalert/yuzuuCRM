-- ─────────────────────────────────────────────────────────────────────────────
-- Revenue Engine — Database Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────

create type plan_type as enum ('free', 'starter', 'growth', 'enterprise');
create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled');
create type user_role as enum ('owner', 'admin', 'member');
create type invite_status as enum ('pending', 'accepted');
create type account_status as enum ('new', 'contacted', 'in_progress', 'qualified', 'not_a_fit');
create type deal_stage as enum ('discovery', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
create type activity_type as enum ('email', 'meeting', 'call', 'note', 'linkedin');
create type activity_direction as enum ('inbound', 'outbound');
create type activity_source as enum ('gmail', 'calendar', 'aircall', 'manual', 'linkedin');
create type sequence_status as enum ('draft', 'active', 'paused');
create type enrollment_status as enum ('active', 'paused', 'completed', 'replied', 'unsubscribed', 'bounced');
create type signal_type as enum ('hiring', 'funding', 'tech_change', 'web_visit', 'news', 'job_change');
create type sentiment as enum ('positive', 'neutral', 'negative');

-- ── 1. workspaces ─────────────────────────────────────────────────────────────

create table workspaces (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null unique,
  plan                  plan_type not null default 'free',
  subscription_status   subscription_status not null default 'trialing',
  trial_ends_at         timestamptz,
  stripe_customer_id    text,
  stripe_subscription_id text,
  seat_limit            int not null default 3,
  account_limit         int not null default 500,
  logo_url              text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── 2. users ──────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users

create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  full_name     text not null,
  email         text not null,
  role          user_role not null default 'member',
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 3. invitations ────────────────────────────────────────────────────────────

create table invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text not null,
  role         user_role not null default 'member',
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  status       invite_status not null default 'pending',
  invited_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);

-- ── 4. icps ───────────────────────────────────────────────────────────────────

create table icps (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  name                text not null,
  industries          text[] not null default '{}',
  company_size_min    int,
  company_size_max    int,
  locations           text[] not null default '{}',
  keywords            text[] not null default '{}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── 5. accounts ───────────────────────────────────────────────────────────────

create table accounts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  name             text not null,
  domain           text,
  industry         text,
  employee_count   int,
  location         text,
  ai_score         int check (ai_score >= 0 and ai_score <= 100),
  status           account_status not null default 'new',
  website          text,
  linkedin_url     text,
  description      text,
  icp_id           uuid references icps(id) on delete set null,
  last_activity_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── 6. contacts ───────────────────────────────────────────────────────────────

create table contacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  first_name   text not null,
  last_name    text,
  email        text,
  phone        text,
  title        text,
  linkedin_url text,
  avatar_url   text,
  is_unsubscribed boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── 7. deals ──────────────────────────────────────────────────────────────────

create table deals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  contact_id   uuid references contacts(id) on delete set null,
  owner_id     uuid references users(id) on delete set null,
  name         text not null,
  value        numeric(12, 2),
  stage        deal_stage not null default 'discovery',
  close_date   date,
  notes        text,
  health       text check (health in ('green', 'amber', 'red')) default 'green',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── 8. activities ─────────────────────────────────────────────────────────────

create table activities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  contact_id   uuid references contacts(id) on delete set null,
  deal_id      uuid references deals(id) on delete set null,
  user_id      uuid references users(id) on delete set null,
  type         activity_type not null,
  direction    activity_direction,
  source       activity_source not null default 'manual',
  subject      text,
  body         text,
  summary      text,
  sentiment    sentiment,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ── 9. sequences ──────────────────────────────────────────────────────────────

create table sequences (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_id     uuid references users(id) on delete set null,
  name         text not null,
  status       sequence_status not null default 'draft',
  steps        jsonb not null default '[]',
  sending_account text,
  send_window  text,
  ai_personalization boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── 10. sequence_enrollments ──────────────────────────────────────────────────

create table sequence_enrollments (
  id           uuid primary key default gen_random_uuid(),
  sequence_id  uuid not null references sequences(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  status       enrollment_status not null default 'active',
  current_step int not null default 0,
  enrolled_at  timestamptz not null default now(),
  completed_at timestamptz,
  unique (sequence_id, contact_id)
);

-- ── 11. sequence_step_logs ────────────────────────────────────────────────────

create table sequence_step_logs (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references sequence_enrollments(id) on delete cascade,
  sequence_id   uuid not null references sequences(id) on delete cascade,
  step_number   int not null,
  type          activity_type not null,
  subject       text,
  body          text,
  sent_at       timestamptz,
  opened_at     timestamptz,
  replied_at    timestamptz,
  bounced_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ── 12. signals ───────────────────────────────────────────────────────────────

create table signals (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  account_id      uuid references accounts(id) on delete set null,
  type            signal_type not null,
  title           text not null,
  body            text,
  source_url      text,
  relevance_score int check (relevance_score >= 0 and relevance_score <= 100),
  is_read         boolean not null default false,
  detected_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

create index idx_accounts_workspace_score   on accounts (workspace_id, ai_score desc);
create index idx_accounts_workspace_status  on accounts (workspace_id, status);
create index idx_contacts_account           on contacts (account_id);
create index idx_contacts_workspace         on contacts (workspace_id);
create index idx_deals_workspace_stage      on deals (workspace_id, stage);
create index idx_deals_owner                on deals (owner_id);
create index idx_activities_account_time    on activities (account_id, occurred_at desc);
create index idx_activities_workspace_time  on activities (workspace_id, occurred_at desc);
create index idx_signals_workspace_time     on signals (workspace_id, detected_at desc);
create index idx_signals_account            on signals (account_id);
create index idx_enrollments_sequence_status on sequence_enrollments (sequence_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper function to get current user's workspace_id
create or replace function get_user_workspace_id()
returns uuid
language sql
stable
security definer
as $$
  select workspace_id from users where id = auth.uid()
$$;

-- Helper function to get current user's role
create or replace function get_user_role()
returns user_role
language sql
stable
security definer
as $$
  select role from users where id = auth.uid()
$$;

-- workspaces
alter table workspaces enable row level security;

create policy "Users can view their own workspace"
  on workspaces for select
  using (id = get_user_workspace_id());

create policy "Owners can update their workspace"
  on workspaces for update
  using (id = get_user_workspace_id() and get_user_role() = 'owner');

-- users
alter table users enable row level security;

create policy "Users can view all members of their workspace"
  on users for select
  using (workspace_id = get_user_workspace_id());

create policy "Users can update their own record"
  on users for update
  using (id = auth.uid());

create policy "Service role can insert users"
  on users for insert
  with check (true);

-- invitations
alter table invitations enable row level security;

create policy "Admins and owners can insert invitations"
  on invitations for insert
  with check (
    workspace_id = get_user_workspace_id()
    and get_user_role() in ('owner', 'admin')
  );

create policy "Anyone can read invitation by token (public)"
  on invitations for select
  using (true);

create policy "Admins can view workspace invitations"
  on invitations for select
  using (workspace_id = get_user_workspace_id());

-- icps
alter table icps enable row level security;

create policy "Workspace members can view ICPs"
  on icps for select using (workspace_id = get_user_workspace_id());

create policy "Admins can manage ICPs"
  on icps for all
  using (workspace_id = get_user_workspace_id() and get_user_role() in ('owner', 'admin'));

-- accounts
alter table accounts enable row level security;

create policy "Workspace members can view accounts"
  on accounts for select using (workspace_id = get_user_workspace_id());

create policy "Workspace members can insert accounts"
  on accounts for insert with check (workspace_id = get_user_workspace_id());

create policy "Workspace members can update accounts"
  on accounts for update using (workspace_id = get_user_workspace_id());

create policy "Admins can delete accounts"
  on accounts for delete
  using (workspace_id = get_user_workspace_id() and get_user_role() in ('owner', 'admin'));

-- contacts
alter table contacts enable row level security;

create policy "Workspace members can view contacts"
  on contacts for select using (workspace_id = get_user_workspace_id());

create policy "Workspace members can insert contacts"
  on contacts for insert with check (workspace_id = get_user_workspace_id());

create policy "Workspace members can update contacts"
  on contacts for update using (workspace_id = get_user_workspace_id());

create policy "Admins can delete contacts"
  on contacts for delete
  using (workspace_id = get_user_workspace_id() and get_user_role() in ('owner', 'admin'));

-- deals
alter table deals enable row level security;

create policy "Workspace members can view deals"
  on deals for select using (workspace_id = get_user_workspace_id());

create policy "Workspace members can insert deals"
  on deals for insert with check (workspace_id = get_user_workspace_id());

create policy "Workspace members can update deals"
  on deals for update using (workspace_id = get_user_workspace_id());

create policy "Admins can delete deals"
  on deals for delete
  using (workspace_id = get_user_workspace_id() and get_user_role() in ('owner', 'admin'));

-- activities
alter table activities enable row level security;

create policy "Workspace members can view activities"
  on activities for select using (workspace_id = get_user_workspace_id());

create policy "Workspace members can insert activities"
  on activities for insert with check (workspace_id = get_user_workspace_id());

create policy "Workspace members can update activities"
  on activities for update using (workspace_id = get_user_workspace_id());

-- sequences
alter table sequences enable row level security;

create policy "Workspace members can view sequences"
  on sequences for select using (workspace_id = get_user_workspace_id());

create policy "Workspace members can insert sequences"
  on sequences for insert with check (workspace_id = get_user_workspace_id());

create policy "Workspace members can update sequences"
  on sequences for update using (workspace_id = get_user_workspace_id());

create policy "Admins can delete sequences"
  on sequences for delete
  using (workspace_id = get_user_workspace_id() and get_user_role() in ('owner', 'admin'));

-- sequence_enrollments
alter table sequence_enrollments enable row level security;

create policy "Workspace members can view enrollments"
  on sequence_enrollments for select using (workspace_id = get_user_workspace_id());

create policy "Workspace members can manage enrollments"
  on sequence_enrollments for all using (workspace_id = get_user_workspace_id());

-- sequence_step_logs
alter table sequence_step_logs enable row level security;

create policy "Workspace members can view step logs"
  on sequence_step_logs for select
  using (
    sequence_id in (
      select id from sequences where workspace_id = get_user_workspace_id()
    )
  );

-- signals
alter table signals enable row level security;

create policy "Workspace members can view signals"
  on signals for select using (workspace_id = get_user_workspace_id());

create policy "Workspace members can update signals"
  on signals for update using (workspace_id = get_user_workspace_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers — auto-update updated_at
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_updated_at before update on workspaces
  for each row execute function touch_updated_at();
create trigger users_updated_at before update on users
  for each row execute function touch_updated_at();
create trigger icps_updated_at before update on icps
  for each row execute function touch_updated_at();
create trigger accounts_updated_at before update on accounts
  for each row execute function touch_updated_at();
create trigger contacts_updated_at before update on contacts
  for each row execute function touch_updated_at();
create trigger deals_updated_at before update on deals
  for each row execute function touch_updated_at();
create trigger sequences_updated_at before update on sequences
  for each row execute function touch_updated_at();
