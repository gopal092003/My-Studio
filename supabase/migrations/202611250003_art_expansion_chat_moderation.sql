alter type public.notification_kind add value if not exists 'chat_message_removed';
alter type public.notification_kind add value if not exists 'report_reviewed';
grant usage on type public.notification_kind to authenticated, service_role;

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
        then 'Your account is restricted from liking, commenting, and sending Art chat messages. You can still view the site.'
        else 'Your restriction has been lifted. You can like, comment, and send Art chat messages again.'
      end || case when new.is_restricted and coalesce(new.restriction_reason, '') <> ''
        then ' Reason: ' || new.restriction_reason
        else ''
      end
    );
  end if;
  return new;
end;
$$;

alter table public.artworks
  add column description text check (description is null or length(description) <= 5000),
  add column medium text check (medium is null or length(medium) <= 100),
  add column dimensions text check (dimensions is null or length(dimensions) <= 100),
  add column scheduled_publish_at timestamptz;

drop index if exists public.artworks_search_idx;
alter table public.artworks drop column search_document;
alter table public.artworks
  add column search_document tsvector not null default ''::tsvector;

create or replace function public.update_artwork_search_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_document := to_tsvector(
    'simple'::regconfig,
    coalesce(new.name, '') || ' ' || coalesce(new.description, '') || ' ' ||
    coalesce(new.medium, '') || ' ' || coalesce(new.dimensions, '') || ' ' ||
    array_to_string(new.tags, ' ')
  );
  return new;
end;
$$;

drop trigger if exists artwork_search_document on public.artworks;
create trigger artwork_search_document
  before insert or update of name, description, medium, dimensions, tags on public.artworks
  for each row execute function public.update_artwork_search_document();

update public.artworks
set search_document = to_tsvector(
  'simple'::regconfig,
  coalesce(name, '') || ' ' || coalesce(description, '') || ' ' ||
  coalesce(medium, '') || ' ' || coalesce(dimensions, '') || ' ' ||
  array_to_string(tags, ' ')
);
create index artworks_search_idx on public.artworks using gin (search_document);
create index artworks_visible_medium_idx on public.artworks (lower(medium)) where is_visible;
create index artworks_visible_scheduled_idx on public.artworks (scheduled_publish_at)
  where is_visible and scheduled_publish_at is not null;

create table public.artwork_images (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  image_path text not null unique,
  alt_text text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

insert into public.artwork_images (artwork_id, image_path, alt_text, sort_order)
select id, image_path, name, 0
from public.artworks
on conflict (image_path) do nothing;

create index artwork_images_artwork_order_idx
  on public.artwork_images (artwork_id, sort_order, created_at);

create function public.admin_replace_artwork_images(p_artwork_id uuid, p_image_paths text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_total integer;
  artwork_name text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can replace artwork images' using errcode = '42501';
  end if;

  image_total := coalesce(array_length(p_image_paths, 1), 0);
  if image_total < 1 or image_total > 20 then
    raise exception 'Artwork must have between 1 and 20 images' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_image_paths) as paths(image_path)
    where paths.image_path is null
      or paths.image_path = ''
      or paths.image_path not like p_artwork_id::text || '/%'
  ) then
    raise exception 'Artwork image path is invalid' using errcode = '22023';
  end if;

  select name into artwork_name from public.artworks where id = p_artwork_id;
  if artwork_name is null then
    raise exception 'Artwork does not exist' using errcode = '22023';
  end if;

  delete from public.artwork_images where artwork_id = p_artwork_id;
  insert into public.artwork_images (artwork_id, image_path, alt_text, sort_order)
  select p_artwork_id, image_path, artwork_name, image_order::integer - 1
  from unnest(p_image_paths) with ordinality as images(image_path, image_order);

  update public.artworks set image_path = p_image_paths[1] where id = p_artwork_id;
end;
$$;

revoke all on function public.admin_replace_artwork_images(uuid, text[]) from public, anon;
grant execute on function public.admin_replace_artwork_images(uuid, text[]) to authenticated;

create table public.art_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null default 'Studio User',
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index art_chat_messages_created_idx on public.art_chat_messages (created_at desc);
create index art_chat_messages_user_idx on public.art_chat_messages (user_id, created_at desc);

create function public.enforce_art_chat_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.art_chat_messages
    where user_id = new.user_id
      and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Please wait a moment before sending another message' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger art_chat_message_rate_limit
  before insert on public.art_chat_messages
  for each row execute function public.enforce_art_chat_rate_limit();

alter table public.art_chat_messages replica identity full;

create type public.moderation_report_target as enum ('artwork_comment', 'chat_message');
create type public.moderation_report_status as enum ('open', 'reviewed', 'dismissed');
grant usage on type public.moderation_report_target, public.moderation_report_status to authenticated, service_role;

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.moderation_report_target not null,
  target_id uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  status public.moderation_report_status not null default 'open',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);

create index moderation_reports_status_created_idx
  on public.moderation_reports (status, created_at desc);
create index moderation_reports_target_idx
  on public.moderation_reports (target_type, target_id);

create or replace function public.set_art_chat_message_author()
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

create trigger art_chat_message_set_author
  before insert on public.art_chat_messages
  for each row execute function public.set_art_chat_message_author();

create or replace function public.notify_art_chat_message_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = old.user_id and role = 'user'::public.app_role
  ) then
    insert into public.notifications (recipient_id, kind, message)
    values (
      old.user_id,
      'chat_message_removed'::public.notification_kind,
      'An admin removed your message from the Art chatroom.'
    );
  end if;
  return old;
end;
$$;

create trigger art_chat_message_removal_notification
  after delete on public.art_chat_messages
  for each row execute function public.notify_art_chat_message_removed();

create or replace function public.validate_moderation_report_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_type = 'artwork_comment'::public.moderation_report_target then
    if not exists (
      select 1
      from public.artwork_comments as comment
      join public.artworks as artwork on artwork.id = comment.artwork_id
      where comment.id = new.target_id
        and artwork.is_visible
        and (artwork.scheduled_publish_at is null or artwork.scheduled_publish_at <= now())
    ) then
      raise exception 'This comment cannot be reported' using errcode = '22023';
    end if;
  elsif not exists (
    select 1 from public.art_chat_messages where id = new.target_id
  ) then
    raise exception 'This chat message cannot be reported' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger moderation_report_validate_target
  before insert on public.moderation_reports
  for each row execute function public.validate_moderation_report_target();

create or replace function public.notify_report_reviewed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'open'::public.moderation_report_status
      and new.status in ('reviewed'::public.moderation_report_status, 'dismissed'::public.moderation_report_status) then
    insert into public.notifications (recipient_id, kind, message)
    values (
      new.reporter_id,
      'report_reviewed'::public.notification_kind,
      case when new.status = 'reviewed'::public.moderation_report_status
        then 'An admin reviewed a report you submitted.'
        else 'An admin reviewed and dismissed a report you submitted.'
      end
    );
  end if;
  return new;
end;
$$;

create trigger moderation_report_review_notification
  after update of status on public.moderation_reports
  for each row execute function public.notify_report_reviewed();

create function public.admin_delete_art_chat_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete Art chat messages' using errcode = '42501';
  end if;
  delete from public.art_chat_messages where id = p_message_id;
end;
$$;

revoke all on function public.admin_delete_art_chat_message(uuid) from public, anon;
grant execute on function public.admin_delete_art_chat_message(uuid) to authenticated;

alter table public.artwork_images enable row level security;
alter table public.art_chat_messages enable row level security;
alter table public.moderation_reports enable row level security;

revoke all on public.artwork_images from anon, authenticated;
revoke all on public.art_chat_messages from anon, authenticated;
revoke all on public.moderation_reports from anon, authenticated;

grant select on public.artwork_images to anon, authenticated;
grant insert, update, delete on public.artwork_images to authenticated;
grant all on public.artwork_images to service_role;

grant select, insert on public.art_chat_messages to authenticated;
grant all on public.art_chat_messages to service_role;

grant select, insert, update on public.moderation_reports to authenticated;
grant all on public.moderation_reports to service_role;

create policy "Anyone reads images for visible artwork"
  on public.artwork_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.artworks
      where id = artwork_id
        and is_visible
        and (scheduled_publish_at is null or scheduled_publish_at <= now())
    )
  );

create policy "Admins manage artwork images"
  on public.artwork_images
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Signed-in users read Art chat messages"
  on public.art_chat_messages
  for select
  to authenticated
  using (true);

create policy "Unrestricted signed-in users send Art chat messages"
  on public.art_chat_messages
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and not (select public.is_restricted_user())
  );

create policy "Users read their own reports; admins read all"
  on public.moderation_reports
  for select
  to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "Signed-in users report content"
  on public.moderation_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'::public.moderation_report_status
    and handled_by is null
    and handled_at is null
  );

create policy "Admins update report status"
  on public.moderation_reports
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Anyone reads visible artwork" on public.artworks;
create policy "Anyone reads published visible artwork"
  on public.artworks
  for select
  to anon, authenticated
  using (
    is_visible
    and (scheduled_publish_at is null or scheduled_publish_at <= now())
  );

drop policy if exists "Unrestricted users like visible artwork" on public.artwork_likes;
create policy "Unrestricted users like published artwork"
  on public.artwork_likes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and not (select public.is_restricted_user())
    and exists (
      select 1 from public.artworks
      where id = artwork_id
        and is_visible
        and (scheduled_publish_at is null or scheduled_publish_at <= now())
    )
  );

drop policy if exists "Anyone reads comments on visible artwork" on public.artwork_comments;
create policy "Anyone reads comments on published artwork"
  on public.artwork_comments
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.artworks
      where id = artwork_id
        and is_visible
        and (scheduled_publish_at is null or scheduled_publish_at <= now())
    )
  );

drop policy if exists "Users comment on visible artwork" on public.artwork_comments;
create policy "Users comment on published artwork"
  on public.artwork_comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and parent_comment_id is null
    and not (select public.is_restricted_user())
    and exists (
      select 1 from public.artworks
      where id = artwork_id
        and is_visible
        and (scheduled_publish_at is null or scheduled_publish_at <= now())
    )
  );

create or replace function public.record_artwork_view(p_artwork_id uuid, p_visitor_id uuid)
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
    where id = p_artwork_id
      and is_visible
      and (scheduled_publish_at is null or scheduled_publish_at <= now())
  )
  on conflict (artwork_id, visitor_id, viewed_on) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count > 0;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'art_chat_messages'
      ) then
    alter publication supabase_realtime add table public.art_chat_messages;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
      ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
