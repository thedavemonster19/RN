-- Remove throwaway accounts from the all-time leaderboard tests. Same narrow,
-- prefix-anchored matching as the earlier cleanups; deleting the auth user
-- cascades to profile, daily_scores and best_scores.
delete from auth.users
where email ~ '^(probe|verify|bypass|rls|mod|alltime)[.]';
