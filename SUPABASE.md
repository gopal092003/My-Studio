# Supabase accounts, content, and database setup

This app has one account system and one administrator role. New accounts receive
the `user` role automatically. Users can read published content. Only an account
promoted to `admin` can create, edit, publish, unpublish, or delete content.

## 1. Create the Supabase project

Create a Supabase project for the primary project. It stores Supabase Auth
accounts, profile roles, and the content for pages assigned to `primary`.

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_PRIMARY_URL`
- `NEXT_PUBLIC_SUPABASE_PRIMARY_PUBLISHABLE_KEY`
- `SUPABASE_PRIMARY_SECRET_KEY` (server-only; used by the artwork view counter)

Find these in the Supabase project's API settings. Restart `npm run dev` after
changing environment values.

The Next.js workspace reads env files from `apps/web`, so place local values in
`apps/web/.env.local`. `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are also accepted as primary-project
aliases when those variables are available to Next.js.

## 2. Create the tables and access policies

Open **SQL Editor** in the primary project and run the migration at
`supabase/migrations/202611250001_content_and_roles.sql`. It creates:

- `profiles`, with a role that defaults to `user`;
- `content_items`, with a section, title, optional text/media URL, and publish flag;
- an Auth signup trigger that creates a user profile;
- a database constraint that allows at most one `admin` profile;
- Row Level Security (RLS) policies for public published reads and admin-only
  content changes.

Run the migration once per project. It also adds profiles for Auth users that
existed before the migration.

## 2a. Enable the Art gallery database

After the first migration has run in the primary project, run
`supabase/migrations/202611250002_artwork_gallery.sql` in that project's SQL
Editor. This creates the Art tables, counters, comment and restriction
notifications, RLS policies, and the public `artworks` Storage bucket. The app
uses that bucket for uploaded images; it accepts JPEG, PNG, WebP, and GIF files
up to 10 MB.

Then run `supabase/migrations/202611250003_art_expansion_chat_moderation.sql`.
It adds descriptions, medium, dimensions, scheduled publishing, a separate image
list (and copies each existing cover image into it), the Art chatroom, and the
community moderation report queue. It also adds the chat and notifications
tables to the Supabase Realtime publication. If migration 002 is already
installed, run 003 as a new additive migration; don't edit applied migration
files.

Art stays in the primary project because its likes, comments, user restrictions,
notifications, and Auth roles all use the primary project's identities. Other
page content can use the optional secondary project described below. Moving Art
to another project later requires migrating its artwork and interaction tables,
Storage objects, and authorization policies together.

## 3. Configure Auth redirects

In the primary project, open **Authentication → URL Configuration**. Set the
local Site URL to `http://localhost:3000` and add
`http://localhost:3000/auth/callback` to the allowed redirect URLs. Add the
equivalent deployed website URLs before production use. Choose whether email
confirmation is required under **Authentication → Providers → Email**, and make
sure new user signups are enabled.

Users can sign up at `/signup` and log in at `/login`. If email confirmation is
enabled, they must confirm their address before the first login.

## 4. Promote your account to the only admin

1. Sign up at `/signup` with the email address you will use as the site owner.
2. Confirm that account if email confirmation is enabled.
3. In the primary project's SQL Editor, run this query, replacing the email:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where lower(email) = lower('you@example.com')
);
```

4. Confirm that exactly one row changed, then log in at `/login` and open `/admin`.

Signup metadata cannot set a role. The app has no role-editing screen, and RLS
does not allow users to change their own role. Promote another account only by
running an explicit SQL update in the Supabase dashboard.

## 5. Art page behavior

- Open `/art` to browse visible paintings, sketches, and other artwork. The
  admin tools are at `/admin/art`.
- Search matches complete words in the artwork name, description, medium,
  dimensions, and tags. It doesn't do partial-word or fuzzy matching. When
  searching multiple words, every word must match.
- Selecting multiple tags returns artwork with **any** selected tag.
- Medium filtering matches the selected medium value.
- Sort choices are newest, oldest, case-insensitive name A–Z/Z–A, most viewed, most liked, and
  most commented. A view is counted once per browser per artwork per day when
  its detail page is opened.
- Artwork detail pages support up to 20 images, plus a description, medium,
  dimensions, and tags. The displayed creation date is the database `created_at`
  date. Series are not modeled yet.
- The admin can schedule a visible artwork for a future date and time. Database
  read policies keep it hidden until then, so no cron job is needed. Unchecking
  publish keeps it hidden.
- Bulk upload accepts up to 25 images at a time. Each filename becomes the
  artwork name; the chosen medium and tags are applied to every uploaded image.
- Signed-in users can like and comment. Likes are unique per user and artwork.
  Comments have no likes. Only the admin can reply to a comment or delete one.
- Signed-in users can join the Art chatroom. Messages are stored in the primary
  database, appear live through Supabase Realtime, and are limited to 2,000
  characters with a short per-user send cooldown.
- The admin can hide artwork while keeping it in the admin desk, or delete it.
  Deleting artwork also deletes its comments, likes, views, and image files.
- Users can report artwork comments and chat messages. The admin reviews them at
  `/admin/moderation`, can remove content or close/dismiss a report, and the
  reporter receives a notification when the report is handled.
- Restricting a user disables new likes, comments, and chat messages; viewing and
  reporting remain available. Removed comments and chat messages, and restriction
  changes, create in-app notifications at `/notifications`.
- Community moderation currently covers Art comments and the Art chatroom. Use
  the same report queue and account restrictions for interactive features added
  on other pages. The analytics admin dashboard is on hold.

The primary secret key is needed to record deduplicated views. It is used only
inside server code and must never have the `NEXT_PUBLIC_` prefix. The app also
accepts `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` as server-only
aliases. If no secret key is configured, artwork pages still load but new views
are not recorded. Public page reads and image display use the publishable key
and RLS policies.

## 6. Optional second Supabase project

The primary project remains the only Auth project, so users keep one account.
To put generic content for selected non-Art pages in a second project:

1. Create the second Supabase project.
2. Run the same migration in that project's SQL Editor. This gives it the same
   content table and public-read RLS policy.
3. Add its URL and publishable key to `apps/web/.env.local` as
   `NEXT_PUBLIC_SUPABASE_SECONDARY_URL` and
   `NEXT_PUBLIC_SUPABASE_SECONDARY_PUBLISHABLE_KEY`.
4. Add its **secret** key as `SUPABASE_SECONDARY_SECRET_KEY`. This value is
   server-only and is used by the admin server actions after they verify your
   admin role in the primary project.
5. In `apps/web/features/landing/data/realms.ts`, change the relevant page's
   `supabaseProject` from `primary` to `secondary`.

Secondary-project admin writes use the secret key, which bypasses RLS. The
server action checks the signed-in user's admin role in the primary project
before using it. Keep that key out of `NEXT_PUBLIC_` variables, browser code,
source control, and chat. Secondary content stores the primary account UUID as
its `created_by` value; user accounts and roles remain in the primary project.
If a page already has content, move those rows to the destination project before
changing its mapping so the page continues to find them.

Content currently supports a title, short description, plain text, optional
media URL, and a published/draft flag. Media URLs can point to an external asset;
Supabase Storage buckets are not created by this migration.

When adding a new page section, add its slug to the TypeScript section list and
create a follow-up SQL migration that adds the value to `content_section` in each
project. Don't edit an already-applied migration to change a live database.

## Access rules

- Signed-out visitors and signed-in users can read published content.
- Draft content is visible only in the admin area.
- Only the admin role can change content through the app.
- Profiles are readable by their owner; clients cannot assign or change roles.

The migration enables RLS and grants only the table operations the app needs.
Keep RLS enabled on any future tables and add policies before exposing them.

## Supabase references

- [Next.js server-side auth and cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Supabase Realtime subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Publishable and secret API keys](https://supabase.com/docs/guides/getting-started/api-keys)
