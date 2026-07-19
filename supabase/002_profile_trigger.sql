-- Run this in the Supabase SQL Editor (it's also included in schema.sql, so
-- if you'd rather just re-run that whole file, do that instead — both are
-- safe to run repeatedly).
--
-- Fixes: with email confirmation enabled (Supabase's default), sign-up hands
-- back a user but no session. A client-side profile insert therefore has no
-- auth.uid(), and Row Level Security correctly refuses it — so accounts were
-- being created with no profile attached. This trigger creates the profile
-- server-side the moment the account exists.

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
