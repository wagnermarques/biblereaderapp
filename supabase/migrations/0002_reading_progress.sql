-- Bíblia PWA — reading-progress tracking (per-verse, auto-marked as each
-- verse scrolls into view + manually toggleable). Run this once in the
-- Supabase project's SQL Editor, after 0001_init.sql.
--
-- There's no separate "read chapters" table: a chapter's read status is
-- derived client-side (every one of its verses present here), so it doesn't
-- need its own row.

create table public.read_verses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  chapter integer not null,
  verse integer not null,
  read_at timestamptz not null default now(),
  unique (user_id, book_id, chapter, verse)
);

alter table public.read_verses enable row level security;

create policy "Users can view their own read verses"
  on public.read_verses for select
  using (auth.uid() = user_id);

create policy "Users can add their own read verses"
  on public.read_verses for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own read verses"
  on public.read_verses for delete
  using (auth.uid() = user_id);
