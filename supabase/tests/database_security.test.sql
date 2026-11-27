begin;

select plan(9);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'member@test.invalid', '', now(), '{}', '{"display_name":"Member"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'other@test.invalid', '', now(), '{}', '{"display_name":"Other"}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'admin@test.invalid', '', now(), '{}', '{"display_name":"Admin"}', now(), now())
on conflict (id) do nothing;

update public.profiles
set role = 'admin'::public.app_role
where id = '33333333-3333-4333-8333-333333333333';

insert into public.content_items (id, section_slug, title, is_published, scheduled_publish_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'craft', 'Public test item', true, null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'craft', 'Hidden test item', false, null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'craft', 'Scheduled test item', true, now() + interval '1 year');

set local role anon;
select is((select count(*) from public.content_items), 1::bigint, 'anonymous users only see published, currently available content');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*) from public.profiles), 1::bigint, 'a member can only read their own profile');
select is((select count(*) from public.content_items), 1::bigint, 'a member only sees published, currently available content');
select throws_ok(
  $$insert into public.content_items (section_slug, title, is_published) values ('craft', 'Unauthorized', true)$$,
  '42501',
  'a member cannot create content'
);
select throws_ok(
  $$update public.profiles set role = 'admin'::public.app_role where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  'a member cannot promote their own profile'
);
select throws_ok(
  $$insert into public.content_item_likes (content_item_id, user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '33333333-3333-4333-8333-333333333333')$$,
  '42501',
  'a member cannot create a like for another user'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is((select count(*) from public.profiles), 3::bigint, 'the admin can read all profiles');
select lives_ok(
  $$insert into public.content_items (section_slug, title, is_published) values ('craft', 'Admin-created item', true)$$,
  'the admin can create content'
);
select is((select count(*) from public.content_items), 4::bigint, 'the admin sees all content and their new item');

select * from finish();
rollback;
