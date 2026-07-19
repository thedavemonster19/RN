-- Close the verification bypass.
--
-- The verify-run edge function re-derives every score server-side, but the
-- original RLS policies still let a signed-in player INSERT or UPDATE their own
-- row directly — skipping verification entirely. Confirmed in testing: a client
-- posted 999,999,999 straight to daily_scores and it was accepted.
--
-- Fix: revoke client writes completely. The edge function connects with the
-- service_role key, which bypasses RLS by design, so it keeps working. With RLS
-- enabled and no INSERT/UPDATE policy, every other write is refused.

drop policy if exists "insert own score" on public.daily_scores;
drop policy if exists "update own score" on public.daily_scores;

-- Reads stay public — the leaderboard needs them.
-- (The "scores are public" SELECT policy is left exactly as it was.)

-- Belt and braces: even if a policy is added back by mistake, the anon and
-- authenticated roles have no table-level write grant to fall back on.
revoke insert, update, delete on public.daily_scores from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bin everything that never passed verification. These are pre-verification
-- test rows plus the 999,999,999 proof-of-concept above; none of them
-- represent a real run.
-- ---------------------------------------------------------------------------
delete from public.daily_scores where verified is not true;

-- ---------------------------------------------------------------------------
-- The leaderboard shows verified runs ONLY, enforced in the view rather than
-- in client code, so an unverified row can never surface by accident.
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
  join public.profiles p on p.id = s.user_id
  where s.verified is true;
