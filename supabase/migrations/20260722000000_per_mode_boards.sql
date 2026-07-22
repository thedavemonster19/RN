-- Per-mode all-time leaderboards.
--
-- Each permanent mode gets its own board. Modes are not balanced against one
-- another and never can be (Big Appetite and Heavy Rain change what a run is
-- worth), so a single pooled table would just rank whichever mode pays best
-- and force every serious player into it.
--
-- Existing rows were all played before modes existed, which is exactly the
-- classic ruleset, so backfilling them as 'classic' is correct rather than a
-- convenient default — no score changes board or meaning.

alter table public.best_scores
  add column if not exists mode text not null default 'classic';

-- One best per (player, mode) instead of one best per player. Done as a
-- primary-key swap rather than a new table so existing verified scores keep
-- their history.
alter table public.best_scores
  drop constraint if exists best_scores_pkey;

alter table public.best_scores
  add constraint best_scores_pkey primary key (user_id, mode);

-- Ranking is always within a mode, so the index has to lead with it; the old
-- index on (score desc) alone would scan every mode's rows for one board.
drop index if exists best_scores_rank;
create index if not exists best_scores_mode_rank
  on public.best_scores (mode, score desc);

-- Expose the mode so the client can ask for one board at a time. Verified rows
-- only, as before, so an unverified score can never surface through the view.
--
-- DROP then CREATE, not CREATE OR REPLACE. Replacing a view can only APPEND
-- columns; inserting `mode` at position 5 pushes `username` to 6, which
-- Postgres reads as renaming column 5 and refuses:
--   ERROR 42P16: cannot change name of view column "username" to "mode"
-- Dropping first costs nothing here — the view holds no data, only a
-- projection — but the grants go with it, so they are re-issued below.
drop view if exists public.all_time_leaderboard;
create view public.all_time_leaderboard as
  select b.score,
         b.milestone,
         b.feeds,
         b.verified,
         b.mode,
         p.username,
         p.monster
  from public.best_scores b
  join public.profiles p on p.id = b.user_id
  where b.verified is true;

-- Dropping the view dropped its grants with it. Supabase's default privileges
-- usually re-grant these for new objects in public, but stating them is what
-- makes the migration reliable rather than dependent on project settings.
grant select on public.all_time_leaderboard to anon, authenticated;
