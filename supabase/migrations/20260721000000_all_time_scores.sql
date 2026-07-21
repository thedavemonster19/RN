-- All-time leaderboard.
--
-- Like daily_scores, these are written ONLY by the verify-run edge function
-- (service_role), never by the client — the score is re-derived from the run's
-- seed and event log before it lands here. Casual runs are just as
-- deterministic as daily ones, so they can be replayed the same way; the seed
-- is submitted with the log.
create table if not exists public.best_scores (
  user_id      uuid primary key references auth.users on delete cascade,
  score        integer not null check (score >= 0),
  milestone    integer not null default 0 check (milestone >= 0),
  feeds        integer not null default 0 check (feeds >= 0),
  drops        integer not null default 0 check (drops >= 0),
  game_version text not null default 'v2',
  verified     boolean not null default false,
  updated_at   timestamptz not null default now()
);

alter table public.best_scores enable row level security;

-- Public to read (it's a leaderboard), impossible for a client to write.
drop policy if exists "best scores are public" on public.best_scores;
create policy "best scores are public"
  on public.best_scores for select
  using (true);

revoke insert, update, delete on public.best_scores from anon, authenticated;

create index if not exists best_scores_rank on public.best_scores (score desc);

-- Usernames joined in, verified rows only, so an unverified score can never
-- surface through client code.
create or replace view public.all_time_leaderboard as
  select b.score,
         b.milestone,
         b.feeds,
         b.verified,
         p.username,
         p.monster
  from public.best_scores b
  join public.profiles p on p.id = b.user_id
  where b.verified is true;
