-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — AI Chat Threads
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ai_chats (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid references users(id) on delete set null,
  title        text not null default 'New chat',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ai_chats_workspace_created
  on ai_chats(workspace_id, created_at desc);

-- ── ai_messages — one row per turn ───────────────────────────────────────────

create table if not exists ai_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references ai_chats(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_chat_id
  on ai_messages(chat_id, created_at asc);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table ai_chats enable row level security;

do $$ begin
  drop policy if exists "users can manage own chats" on ai_chats;
exception when undefined_object then null;
end $$;

-- Users can only see and manage their own chats within their workspace
create policy "users can manage own chats"
  on ai_chats for all
  using (
    workspace_id = get_user_workspace_id()
    and user_id = auth.uid()
  )
  with check (
    workspace_id = get_user_workspace_id()
    and user_id = auth.uid()
  );

alter table ai_messages enable row level security;

do $$ begin
  drop policy if exists "users can manage own chat messages" on ai_messages;
exception when undefined_object then null;
end $$;

-- Messages inherit access from their parent chat
create policy "users can manage own chat messages"
  on ai_messages for all
  using (
    exists (
      select 1 from ai_chats c
      where c.id = ai_messages.chat_id
        and c.workspace_id = get_user_workspace_id()
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from ai_chats c
      where c.id = ai_messages.chat_id
        and c.workspace_id = get_user_workspace_id()
        and c.user_id = auth.uid()
    )
  );
