alter type public.notification_kind add value if not exists 'content_comment_removed';
grant usage on type public.notification_kind to authenticated, service_role;
alter type public.moderation_report_target add value if not exists 'content_item_comment';
grant usage on type public.moderation_report_target to authenticated, service_role;

alter table public.content_items
  add column tags text[] not null default '{}',
  add column medium text check (medium is null or length(medium) <= 100),
  add column dimensions text check (dimensions is null or length(dimensions) <= 100),
  add column media_type text not null default 'text'
    check (media_type in ('text', 'image', 'audio', 'video', 'document', 'external')),
  add column scheduled_publish_at timestamptz,
  add column views_count bigint not null default 0 check (views_count >= 0),
  add column likes_count bigint not null default 0 check (likes_count >= 0),
  add column comments_count bigint not null default 0 check (comments_count >= 0);

update public.content_items
set media_type = case
  when asset_url is null then 'text'
  else 'external'
end;

alter table public.content_items drop column if exists search_document;
alter table public.content_items
  add column name_sort text generated always as (lower(title)) stored,
  add column search_document tsvector not null default ''::tsvector;

create function public.update_content_item_search_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_document := to_tsvector(
    'simple'::regconfig,
    coalesce(new.title, '') || ' ' || coalesce(new.summary, '') || ' ' ||
    coalesce(new.body, '') || ' ' || coalesce(new.medium, '') || ' ' ||
    coalesce(new.dimensions, '') || ' ' || array_to_string(new.tags, ' ')
  );
  return new;
end;
$$;

create trigger content_item_search_document
  before insert or update of title, summary, body, medium, dimensions, tags on public.content_items
  for each row execute function public.update_content_item_search_document();

update public.content_items
set search_document = to_tsvector(
  'simple'::regconfig,
  coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' ||
  coalesce(body, '') || ' ' || coalesce(medium, '') || ' ' ||
  coalesce(dimensions, '') || ' ' || array_to_string(tags, ' ')
);

create index content_items_search_idx on public.content_items using gin (search_document);
create index content_items_tags_idx on public.content_items using gin (tags);
create index content_items_medium_idx on public.content_items (lower(medium)) where is_published;
create index content_items_schedule_idx on public.content_items (scheduled_publish_at)
  where is_published and scheduled_publish_at is not null;
create index content_items_views_idx on public.content_items (views_count desc) where is_published;
create index content_items_likes_idx on public.content_items (likes_count desc) where is_published;
create index content_items_comments_idx on public.content_items (comments_count desc) where is_published;

create or replace function public.get_content_item_facets(p_section_slug public.content_section)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'tags', coalesce((
      select jsonb_agg(distinct tags.tag order by tags.tag)
      from public.content_items as item
      cross join lateral unnest(item.tags) as tags(tag)
      where item.section_slug = p_section_slug and item.is_published
    ), '[]'::jsonb),
    'mediums', coalesce((
      select jsonb_agg(mediums.medium order by mediums.medium)
      from (
        select distinct item.medium
        from public.content_items as item
        where item.section_slug = p_section_slug and item.is_published and item.medium is not null
      ) as mediums
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_content_item_facets(public.content_section) from public;
grant execute on function public.get_content_item_facets(public.content_section) to anon, authenticated;

alter table public.notifications
  add column content_item_id uuid,
  add column content_section_slug public.content_section;

create table public.content_item_images (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  image_path text not null unique,
  alt_text text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index content_item_images_order_idx
  on public.content_item_images (content_item_id, sort_order, created_at);

create function public.admin_replace_content_item_images(
  p_content_item_id uuid,
  p_image_paths text[],
  p_section_slug public.content_section
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_total integer;
  item_title text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can replace page content images' using errcode = '42501';
  end if;
  image_total := coalesce(array_length(p_image_paths, 1), 0);
  if image_total > 20 then
    raise exception 'A content item can have up to 20 images' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_image_paths) as paths(image_path)
    where paths.image_path is null
      or paths.image_path = ''
      or paths.image_path not like p_section_slug::text || '/' || p_content_item_id::text || '/%'
  ) then
    raise exception 'A content image path is invalid' using errcode = '22023';
  end if;

  select title into item_title from public.content_items
  where id = p_content_item_id and section_slug = p_section_slug;
  if item_title is null then
    raise exception 'Page content does not exist in this section' using errcode = '22023';
  end if;

  delete from public.content_item_images where content_item_id = p_content_item_id;
  insert into public.content_item_images (content_item_id, image_path, alt_text, sort_order)
  select p_content_item_id, image_path, item_title, image_order::integer - 1
  from unnest(coalesce(p_image_paths, '{}'::text[])) with ordinality as images(image_path, image_order);
end;
$$;

revoke all on function public.admin_replace_content_item_images(uuid, text[], public.content_section) from public, anon;
grant execute on function public.admin_replace_content_item_images(uuid, text[], public.content_section) to authenticated;

create table public.content_item_likes (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_item_id, user_id)
);

create table public.content_item_comments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  section_slug public.content_section not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_comment_id uuid references public.content_item_comments (id) on delete cascade,
  author_name text not null default 'Studio User',
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index content_item_comments_item_created_idx
  on public.content_item_comments (content_item_id, created_at);
create index content_item_comments_user_idx on public.content_item_comments (user_id);

create table public.content_item_views (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  visitor_id uuid not null,
  viewed_on date not null,
  created_at timestamptz not null default now(),
  primary key (content_item_id, visitor_id, viewed_on)
);

create or replace function public.is_content_item_public(p_content_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.content_items
    where id = p_content_item_id
      and is_published
      and (scheduled_publish_at is null or scheduled_publish_at <= now())
  );
$$;

revoke all on function public.is_content_item_public(uuid) from public, anon;
grant execute on function public.is_content_item_public(uuid) to anon, authenticated;

create or replace function public.set_content_item_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select item.section_slug into new.section_slug
  from public.content_items as item
  where item.id = new.content_item_id;
  select coalesce(nullif(profile.display_name, ''), 'Studio User')
  into new.author_name
  from public.profiles as profile
  where profile.id = new.user_id;
  return new;
end;
$$;

create trigger content_item_comment_set_author
  before insert on public.content_item_comments
  for each row execute function public.set_content_item_comment_author();

create or replace function public.bump_content_item_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.content_items set likes_count = likes_count + 1 where id = new.content_item_id;
    return new;
  end if;
  update public.content_items set likes_count = greatest(likes_count - 1, 0) where id = old.content_item_id;
  return old;
end;
$$;

create trigger content_item_likes_count
  after insert or delete on public.content_item_likes
  for each row execute function public.bump_content_item_likes_count();

create or replace function public.bump_content_item_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.content_items set comments_count = comments_count + 1 where id = new.content_item_id;
    return new;
  end if;

  update public.content_items set comments_count = greatest(comments_count - 1, 0)
  where id = old.content_item_id;

  if exists (
    select 1 from public.profiles
    where id = old.user_id and role = 'user'::public.app_role
  ) then
    insert into public.notifications (recipient_id, kind, message, content_item_id, content_section_slug)
    values (
      old.user_id,
      'content_comment_removed'::public.notification_kind,
      'An admin removed your comment from a page.',
      old.content_item_id,
      old.section_slug
    );
  end if;
  return old;
end;
$$;

create trigger content_item_comments_count
  after insert or delete on public.content_item_comments
  for each row execute function public.bump_content_item_comments_count();

create or replace function public.bump_content_item_views_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.content_items set views_count = views_count + 1 where id = new.content_item_id;
  return new;
end;
$$;

create trigger content_item_views_count
  after insert on public.content_item_views
  for each row execute function public.bump_content_item_views_count();

create function public.record_content_item_view(p_content_item_id uuid, p_visitor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.content_item_views (content_item_id, visitor_id, viewed_on)
  select p_content_item_id, p_visitor_id, (now() at time zone 'utc')::date
  where exists (
    select 1 from public.content_items
    where id = p_content_item_id
      and is_published
      and (scheduled_publish_at is null or scheduled_publish_at <= now())
  )
  on conflict (content_item_id, visitor_id, viewed_on) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count > 0;
end;
$$;

revoke all on function public.record_content_item_view(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_content_item_view(uuid, uuid) to service_role;

create function public.admin_delete_content_item_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete page comments' using errcode = '42501';
  end if;
  delete from public.content_item_comments where id = p_comment_id;
end;
$$;

revoke all on function public.admin_delete_content_item_comment(uuid) from public, anon;
grant execute on function public.admin_delete_content_item_comment(uuid) to authenticated;

create or replace function public.validate_moderation_report_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_type = 'artwork_comment'::public.moderation_report_target then
    if not exists (
      select 1 from public.artwork_comments as comment
      join public.artworks as artwork on artwork.id = comment.artwork_id
      where comment.id = new.target_id and artwork.is_visible
        and (artwork.scheduled_publish_at is null or artwork.scheduled_publish_at <= now())
    ) then
      raise exception 'This comment cannot be reported' using errcode = '22023';
    end if;
  elsif new.target_type = 'content_item_comment'::public.moderation_report_target then
    if not exists (
      select 1 from public.content_item_comments as comment
      join public.content_items as item on item.id = comment.content_item_id
      where comment.id = new.target_id and item.is_published
        and (item.scheduled_publish_at is null or item.scheduled_publish_at <= now())
    ) then
      raise exception 'This page comment cannot be reported' using errcode = '22023';
    end if;
  elsif not exists (
    select 1 from public.art_chat_messages where id = new.target_id
  ) then
    raise exception 'This chat message cannot be reported' using errcode = '22023';
  end if;
  return new;
end;
$$;

alter table public.content_item_images enable row level security;
alter table public.content_item_likes enable row level security;
alter table public.content_item_comments enable row level security;
alter table public.content_item_views enable row level security;

revoke all on public.content_item_images from anon, authenticated;
revoke all on public.content_item_likes from anon, authenticated;
revoke all on public.content_item_comments from anon, authenticated;
revoke all on public.content_item_views from anon, authenticated;

grant select on public.content_item_images to anon, authenticated;
grant insert, update, delete on public.content_item_images to authenticated;
grant all on public.content_item_images to service_role;
grant select, insert, delete on public.content_item_likes to authenticated;
grant all on public.content_item_likes to service_role;
grant select, insert, delete on public.content_item_comments to anon, authenticated;
grant all on public.content_item_comments to service_role;
grant all on public.content_item_views to service_role;

create policy "Anyone reads images for published page content"
  on public.content_item_images for select to anon, authenticated
  using (exists (
    select 1 from public.content_items
    where id = content_item_id and is_published
      and (scheduled_publish_at is null or scheduled_publish_at <= now())
  ));
create policy "Admins manage page content images"
  on public.content_item_images for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Users read their own page likes; admins read all"
  on public.content_item_likes for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Unrestricted users like published page content"
  on public.content_item_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not (select public.is_restricted_user())
    and (select public.is_content_item_public(content_item_id))
  );
create policy "Users remove their own page likes; admins remove any"
  on public.content_item_likes for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Anyone reads comments on published page content"
  on public.content_item_comments for select to anon, authenticated
  using ((select public.is_content_item_public(content_item_id)));
create policy "Admins read comments on hidden page content"
  on public.content_item_comments for select to authenticated
  using ((select public.is_admin()));
create policy "Unrestricted users comment on published page content"
  on public.content_item_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and parent_comment_id is null
    and not (select public.is_restricted_user())
    and (select public.is_content_item_public(content_item_id))
  );
create policy "Admins reply to page comments"
  on public.content_item_comments for insert to authenticated
  with check (
    (select public.is_admin())
    and user_id = (select auth.uid())
    and parent_comment_id is not null
  );
create policy "Admins delete page comments"
  on public.content_item_comments for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Anyone reads published content" on public.content_items;
create policy "Anyone reads scheduled published content"
  on public.content_items for select to anon, authenticated
  using (is_published and (scheduled_publish_at is null or scheduled_publish_at <= now()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-assets',
  'content-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone reads public page content images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'content-assets');
create policy "Admins upload page content images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'content-assets' and (select public.is_admin()));
create policy "Admins delete page content images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'content-assets' and (select public.is_admin()));
