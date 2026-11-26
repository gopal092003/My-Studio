alter table public.profiles
  add column email text,
  add column is_restricted boolean not null default false,
  add column restriction_reason text;

update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where auth_user.id = profile.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create type public.notification_kind as enum (
  'account_restricted',
  'restriction_lifted',
  'comment_removed'
);

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  tags text[] not null default '{}',
  image_path text not null,
  is_visible boolean not null default true,
  views_count bigint not null default 0 check (views_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  comments_count bigint not null default 0 check (comments_count >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name_sort text generated always as (lower(name)) stored,
  search_document tsvector not null default ''::tsvector
);

create function public.update_artwork_search_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_document := to_tsvector(
    'simple'::regconfig,
    coalesce(new.name, '') || ' ' || array_to_string(new.tags, ' ')
  );
  return new;
end;
$$;

create trigger artwork_search_document
  before insert or update of name, tags on public.artworks
  for each row execute function public.update_artwork_search_document();

create index artworks_visible_created_idx
  on public.artworks (created_at desc)
  where is_visible;
create index artworks_visible_name_idx
  on public.artworks (name_sort)
  where is_visible;
create index artworks_visible_views_idx
  on public.artworks (views_count desc)
  where is_visible;
create index artworks_visible_likes_idx
  on public.artworks (likes_count desc)
  where is_visible;
create index artworks_visible_comments_idx
  on public.artworks (comments_count desc)
  where is_visible;
create index artworks_search_idx on public.artworks using gin (search_document);
create index artworks_tags_idx on public.artworks using gin (tags);

create trigger artworks_set_updated_at
  before update on public.artworks
  for each row execute function public.set_updated_at();

create table public.artwork_likes (
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (artwork_id, user_id)
);

create table public.artwork_comments (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_comment_id uuid references public.artwork_comments (id) on delete cascade,
  author_name text not null default 'Studio User',
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index artwork_comments_artwork_created_idx
  on public.artwork_comments (artwork_id, created_at);
create index artwork_comments_user_idx on public.artwork_comments (user_id);

create table public.artwork_views (
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  visitor_id uuid not null,
  viewed_on date not null,
  created_at timestamptz not null default now(),
  primary key (artwork_id, visitor_id, viewed_on)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  message text not null,
  artwork_id uuid,
  comment_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create or replace function public.is_restricted_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select profile.is_restricted
    from public.profiles as profile
    where profile.id = (select auth.uid())
  ), false);
$$;

revoke all on function public.is_restricted_user() from public, anon;
grant execute on function public.is_restricted_user() to authenticated;

create or replace function public.set_artwork_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(nullif(profile.display_name, ''), 'Studio User')
  into new.author_name
  from public.profiles as profile
  where profile.id = new.user_id;
  return new;
end;
$$;

create trigger artwork_comment_set_author
  before insert on public.artwork_comments
  for each row execute function public.set_artwork_comment_author();

create or replace function public.bump_artwork_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.artworks set likes_count = likes_count + 1 where id = new.artwork_id;
    return new;
  end if;

  update public.artworks set likes_count = greatest(likes_count - 1, 0) where id = old.artwork_id;
  return old;
end;
$$;

create trigger artwork_likes_update_count
  after insert or delete on public.artwork_likes
  for each row execute function public.bump_artwork_likes_count();

create or replace function public.bump_artwork_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.artworks set comments_count = comments_count + 1 where id = new.artwork_id;
    return new;
  end if;

  update public.artworks set comments_count = greatest(comments_count - 1, 0) where id = old.artwork_id;

  if exists (
    select 1 from public.profiles
    where id = old.user_id and role = 'user'::public.app_role
  ) then
    insert into public.notifications (recipient_id, kind, message, artwork_id, comment_id)
    values (
      old.user_id,
      'comment_removed'::public.notification_kind,
      'An admin removed your comment from the Art page.',
      old.artwork_id,
      old.id
    );
  end if;

  return old;
end;
$$;

create trigger artwork_comments_update_count
  after insert or delete on public.artwork_comments
  for each row execute function public.bump_artwork_comments_count();

create or replace function public.bump_artwork_views_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.artworks set views_count = views_count + 1 where id = new.artwork_id;
  return new;
end;
$$;

create trigger artwork_views_update_count
  after insert on public.artwork_views
  for each row execute function public.bump_artwork_views_count();

create function public.record_artwork_view(p_artwork_id uuid, p_visitor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.artwork_views (artwork_id, visitor_id, viewed_on)
  select p_artwork_id, p_visitor_id, (now() at time zone 'utc')::date
  where exists (
    select 1 from public.artworks
    where id = p_artwork_id and is_visible
  )
  on conflict (artwork_id, visitor_id, viewed_on) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count > 0;
end;
$$;

revoke all on function public.record_artwork_view(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_artwork_view(uuid, uuid) to service_role;

create function public.admin_delete_artwork_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete artwork comments' using errcode = '42501';
  end if;

  delete from public.artwork_comments where id = p_comment_id;
end;
$$;

revoke all on function public.admin_delete_artwork_comment(uuid) from public, anon;
grant execute on function public.admin_delete_artwork_comment(uuid) to authenticated;

create or replace function public.notify_profile_restriction_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_restricted is distinct from new.is_restricted
      and new.role = 'user'::public.app_role then
    insert into public.notifications (recipient_id, kind, message)
    values (
      new.id,
      case when new.is_restricted
        then 'account_restricted'::public.notification_kind
        else 'restriction_lifted'::public.notification_kind
      end,
      case when new.is_restricted
        then 'Your account is restricted from liking and commenting. You can still view the site.'
        else 'Your restriction has been lifted. You can like and comment again.'
      end || case when new.is_restricted and coalesce(new.restriction_reason, '') <> ''
        then ' Reason: ' || new.restriction_reason
        else ''
      end
    );
  end if;

  return new;
end;
$$;

create trigger profile_restriction_notification
  after update of is_restricted on public.profiles
  for each row execute function public.notify_profile_restriction_change();

alter table public.artworks enable row level security;
alter table public.artwork_likes enable row level security;
alter table public.artwork_comments enable row level security;
alter table public.artwork_views enable row level security;
alter table public.notifications enable row level security;

revoke all on public.artworks from anon, authenticated;
revoke all on public.artwork_likes from anon, authenticated;
revoke all on public.artwork_comments from anon, authenticated;
revoke all on public.artwork_views from anon, authenticated;
revoke all on public.notifications from anon, authenticated;

grant select on public.artworks to anon, authenticated;
grant insert, update, delete on public.artworks to authenticated;
grant all on public.artworks to service_role;

grant select on public.artwork_likes to authenticated;
grant insert, delete on public.artwork_likes to authenticated;
grant all on public.artwork_likes to service_role;

grant select on public.artwork_comments to anon, authenticated;
grant insert, delete on public.artwork_comments to authenticated;
grant all on public.artwork_comments to service_role;

grant all on public.artwork_views to service_role;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

grant update (is_restricted, restriction_reason) on public.profiles to authenticated;

create policy "Anyone reads visible artwork"
  on public.artworks
  for select
  to anon, authenticated
  using (is_visible);

create policy "Admins manage artwork"
  on public.artworks
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Users read their own likes; admins read all likes"
  on public.artwork_likes
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Unrestricted users like visible artwork"
  on public.artwork_likes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and not (select public.is_restricted_user())
    and exists (select 1 from public.artworks where id = artwork_id and is_visible)
  );

create policy "Users remove their own likes; admins remove any like"
  on public.artwork_likes
  for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Anyone reads comments on visible artwork"
  on public.artwork_comments
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.artworks
      where id = artwork_id and is_visible
    )
  );

create policy "Admins read comments on hidden artwork"
  on public.artwork_comments
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Users comment on visible artwork"
  on public.artwork_comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and parent_comment_id is null
    and not (select public.is_restricted_user())
    and exists (select 1 from public.artworks where id = artwork_id and is_visible)
  );

create policy "Admins reply to comments"
  on public.artwork_comments
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins delete comments"
  on public.artwork_comments
  for delete
  to authenticated
  using ((select public.is_admin()));

create policy "Users read their own notifications"
  on public.notifications
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "Users mark their own notifications read"
  on public.notifications
  for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "Admins restrict users"
  on public.profiles
  for update
  to authenticated
  using ((select public.is_admin()) and role = 'user'::public.app_role)
  with check ((select public.is_admin()) and role = 'user'::public.app_role);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artworks',
  'artworks',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone reads public artwork images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'artworks');

create policy "Admins upload artwork images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'artworks' and (select public.is_admin()));

create policy "Admins delete artwork images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'artworks' and (select public.is_admin()));
