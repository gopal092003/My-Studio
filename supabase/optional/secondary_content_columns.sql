-- Optional reduced schema for a secondary content-only project.
-- Run after 202611250001_content_and_roles.sql on that secondary project.
-- Do not run this together with migrations/202611260001_generic_page_features.sql.

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
set media_type = case when asset_url is null then 'text' else 'external' end;

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

drop policy if exists "Anyone reads published content" on public.content_items;
create policy "Anyone reads scheduled published content"
  on public.content_items for select to anon, authenticated
  using (is_published and (scheduled_publish_at is null or scheduled_publish_at <= now()));
