create type public.app_role as enum ('admin', 'user');
create type public.content_section as enum (
  'art',
  'craft',
  'manga',
  'stories',
  'anime',
  'poem',
  'soundtrack'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  section_slug public.content_section not null,
  title text not null check (length(btrim(title)) > 0),
  summary text,
  body text,
  asset_url text,
  is_published boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_only_one_admin
  on public.profiles (role)
  where role = 'admin'::public.app_role;

create index content_items_published_section_created
  on public.content_items (section_slug, created_at desc)
  where is_published;

insert into public.profiles (id, display_name)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'display_name', split_part(coalesce(users.email, ''), '@', 1))
from auth.users as users
on conflict (id) do nothing;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.content_items enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant usage on type public.app_role to authenticated;
grant usage on type public.content_section to anon, authenticated, service_role;

revoke all on public.profiles from anon, authenticated;
revoke all on public.content_items from anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.content_items to anon, authenticated;
grant insert, update, delete on public.content_items to authenticated;
grant all on public.content_items to service_role;

create policy "Users read their own profile; admins read profiles"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Anyone reads published content"
  on public.content_items
  for select
  to anon, authenticated
  using (is_published);

create policy "Admins manage content"
  on public.content_items
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
