-- Monster Muncher — database schema.
--
-- Paste this whole file into your Supabase project's SQL Editor and run it.
-- It is safe to re-run: everything is written to be idempotent.
--
-- WHY ROW LEVEL SECURITY MATTERS HERE
-- The game is a static site, so the anon key is compiled into the public
-- bundle. That is normal and expected for Supabase — the anon key is not a
-- secret. What actually protects your data is RLS: without the policies below,
-- anyone with the key could read and rewrite every row. Never put the
-- service_role key in the client; it bypasses all of this.

-- ---------------------------------------------------------------------------
-- profiles: one row per account, holding the public-facing username
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text not null unique
              check (char_length(username) between 2 and 16),
  monster     text not null default ''
              check (char_length(monster) <= 16),
  best_score  integer not null default 0 check (best_score >= 0),
  best_run    jsonb,
  runs        integer not null default 0 check (runs >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone may read profiles: the leaderboard needs to show usernames.
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public"
  on public.profiles for select
  using (true);

-- You may only create/modify your OWN row.
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Auto-create the profile row when an account is created.
--
-- Why a trigger instead of the client inserting it: with email confirmation
-- switched on (Supabase's default), sign-up returns a user but NO session, so
-- a client-side insert has no auth.uid() and RLS correctly rejects it. The
-- trigger runs as the definer, so the profile exists the moment the account
-- does, confirmed or not. The chosen username rides along in user metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text;
begin
  wanted := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  -- Fall back to a generated handle, and dodge a collision rather than
  -- failing the whole sign-up.
  if wanted is null or exists (select 1 from public.profiles where username = wanted) then
    wanted := 'player' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, username)
  values (new.id, wanted)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- daily_scores: one best result per player per daily challenge
-- ---------------------------------------------------------------------------
create table if not exists public.daily_scores (
  user_id    uuid not null references auth.users on delete cascade,
  daily_key  date not null,
  score      integer not null check (score >= 0),
  milestone  integer not null default 0 check (milestone >= 0),
  feeds      integer not null default 0 check (feeds >= 0),
  drops      integer not null default 0 check (drops >= 0),
  -- Kept for future server-side replay validation: the game is deterministic
  -- given a seed plus the player's inputs, so a run can be re-simulated and
  -- confirmed. Until that exists, treat `verified` as false everywhere.
  game_version text not null default 'v1',
  verified     boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (user_id, daily_key)
);

alter table public.daily_scores enable row level security;

-- The leaderboard is public.
drop policy if exists "scores are public" on public.daily_scores;
create policy "scores are public"
  on public.daily_scores for select
  using (true);

-- You may only submit scores as yourself.
drop policy if exists "insert own score" on public.daily_scores;
create policy "insert own score"
  on public.daily_scores for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own score" on public.daily_scores;
create policy "update own score"
  on public.daily_scores for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nobody may delete scores, so a bad run can't be erased to protect a streak.

-- Fast "today's top 50" lookups.
create index if not exists daily_scores_leaderboard
  on public.daily_scores (daily_key, score desc);

-- ---------------------------------------------------------------------------
-- A view joining scores to usernames, so the client makes one simple query.
-- ---------------------------------------------------------------------------
create or replace view public.daily_leaderboard as
  select s.daily_key,
         s.score,
         s.milestone,
         s.feeds,
         s.verified,
         p.username,
         p.monster
  from public.daily_scores s
  join public.profiles p on p.id = s.user_id;
