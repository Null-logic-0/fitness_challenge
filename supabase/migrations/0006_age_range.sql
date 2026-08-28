-- Adds an age bracket to profiles, collected at signup. A bracket rather
-- than an exact birthdate/age — enough for future age-category leaderboards
-- without storing a precise DOB.
alter table public.profiles add column if not exists age_range text
  check (age_range in ('18-24', '25-34', '35-44', '45-54', '55+'));

-- Re-created to also read age_range from signUp() options.data, alongside
-- the existing display_name/country handling.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));
  insert into public.profiles (id, username, display_name, country, age_range)
  values (
    new.id,
    public.slugify_username(chosen_name),
    chosen_name,
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'age_range'
  );
  return new;
end;
$$;
