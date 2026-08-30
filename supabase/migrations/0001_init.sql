-- Bíblia PWA — initial schema for login + synced bookmarks.
-- Run this once in the Supabase project's SQL Editor (Dashboard > SQL Editor > New query).

-- One row per signed-up user, auto-created by the trigger below.
-- `role` isn't enforced anywhere in the app yet (auth is used only to sync data),
-- but it's here so a future admin area doesn't need a schema change.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bookmarked verses.
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  chapter integer not null,
  verse integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, book_id, chapter, verse)
);

alter table public.bookmarks enable row level security;

create policy "Users can view their own bookmarks"
  on public.bookmarks for select
  using (auth.uid() = user_id);

create policy "Users can add their own bookmarks"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own bookmarks"
  on public.bookmarks for delete
  using (auth.uid() = user_id);
