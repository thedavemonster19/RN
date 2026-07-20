-- Remove the throwaway accounts created while testing signup, RLS and run
-- verification. Their profiles and daily scores cascade away with them, which
-- clears the placeholder names off the leaderboard.
--
-- Scoped to the exact prefixes used by those tests so no real player is caught:
--   probe.*   signup / trigger tests
--   verify.*  verify-run end-to-end tests
--   bypass.*  the RLS bypass proof-of-concept
--   rls.*     early RLS probes
delete from auth.users
where email ~ '^(probe|verify|bypass|rls)[.]';
