export type SupabaseProject = "primary" | "secondary";

export const realms = [
  { slug: "art", title: "Art", supabaseProject: "primary" },
  { slug: "craft", title: "Craft", supabaseProject: "primary" },
  { slug: "manga", title: "Manga", supabaseProject: "primary" },
  { slug: "stories", title: "Stories, Novels and Books", supabaseProject: "primary" },
  { slug: "anime", title: "Anime", supabaseProject: "primary" },
  { slug: "poem", title: "Poem", supabaseProject: "primary" },
  { slug: "soundtrack", title: "SoundTrack", supabaseProject: "primary" },
] as const;

export type Realm = (typeof realms)[number];

export type RealmSlug = Realm["slug"];

export function getRealm(slug: string): Realm | undefined {
  return realms.find((realm) => realm.slug === slug);
}
