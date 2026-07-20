-- More throwaway test accounts to remove (the modifier verification tests use
-- the `mod.` prefix). Same narrow, prefix-anchored matching as before so no
-- real player is ever caught. Deleting the auth user cascades to profile and
-- scores.
delete from auth.users
where email ~ '^(probe|verify|bypass|rls|mod)[.]';
