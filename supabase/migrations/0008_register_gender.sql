-- Gender at registration writes directly into the existing profiles.category
-- column ('open' | 'men' | 'women') — the same column the leaderboard's
-- category filter already reads. No new column needed; this just gives
-- signups a way to actually set it instead of always defaulting to 'open'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));
  insert into public.profiles (id, username, display_name, country, age_range, category)
  values (
    new.id,
    public.slugify_username(chosen_name),
    chosen_name,
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'age_range',
    coalesce(new.raw_user_meta_data ->> 'category', 'open')
  );
  return new;
end;
$$;
