import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getRealm } from "@/features/landing/data/realms";
import { isSupabaseProjectConfigured } from "@/lib/supabase/config";
import { createSupabaseReadClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
type ContentImage = Database["public"]["Tables"]["content_item_images"]["Row"];
type SearchParams = { q?: string | string[]; tag?: string | string[]; medium?: string; sort?: string; page?: string };
type RealmPageProps = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

const pageSize = 12;
const sortOptions = ["newest", "oldest", "title", "title-desc", "views", "likes", "comments"] as const;
type SortOption = (typeof sortOptions)[number];

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: RealmPageProps): Promise<Metadata> {
  const { slug } = await params;
  const realm = getRealm(slug);
  if (!realm) return {};
  return { title: realm.title };
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function RealmPage({ params, searchParams }: RealmPageProps) {
  const [{ slug }, rawParams] = await Promise.all([params, searchParams]);
  const realm = getRealm(slug);
  if (!realm || realm.slug === "art") notFound();

  const query = first(rawParams.q).trim().slice(0, 100);
  const selectedTags = (Array.isArray(rawParams.tag) ? rawParams.tag : rawParams.tag ? [rawParams.tag] : [])
    .map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 20);
  const selectedMedium = first(rawParams.medium).trim();
  const allowedSorts: readonly SortOption[] = realm.supabaseProject === "primary"
    ? sortOptions
    : ["newest", "oldest", "title", "title-desc"];
  const requestedSort = first(rawParams.sort) as SortOption;
  const sort = allowedSorts.includes(requestedSort) ? requestedSort : "newest";
  const parsedPage = Number.parseInt(first(rawParams.page), 10);
  const requestedPage = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;

  let items: ContentItem[] = [];
  let imageRows: ContentImage[] = [];
  let availableTags: string[] = [];
  let availableMediums: string[] = [];
  let resultCount = 0;
  let totalPages = 1;

  if (isSupabaseProjectConfigured(realm.supabaseProject)) {
    const supabase = createSupabaseReadClient(realm.supabaseProject);
    const { data: facets, error: facetsError } = await supabase.rpc("get_content_item_facets", { p_section_slug: realm.slug });
    if (facetsError) throw new Error(`Could not load ${realm.title} filters: ${facetsError.message}`);
    availableTags = facets?.tags ?? [];
    availableMediums = facets?.mediums ?? [];

    let contentQuery = supabase.from("content_items").select("*", { count: "exact" })
      .eq("section_slug", realm.slug).eq("is_published", true);
    if (query) contentQuery = contentQuery.textSearch("search_document", query, { config: "simple", type: "plain" });
    if (selectedTags.length > 0) contentQuery = contentQuery.overlaps("tags", selectedTags);
    if (selectedMedium) contentQuery = contentQuery.eq("medium", selectedMedium);

    const orderBy = sort === "oldest" ? "created_at"
      : sort === "title" || sort === "title-desc" ? "name_sort"
        : sort === "views" ? "views_count"
          : sort === "likes" ? "likes_count"
            : sort === "comments" ? "comments_count" : "created_at";
    contentQuery = contentQuery.order(orderBy, { ascending: sort === "oldest" || sort === "title", nullsFirst: false })
      .order("created_at", { ascending: false });
    const offset = (requestedPage - 1) * pageSize;
    const { data, error, count } = await contentQuery.range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not load ${realm.title} content: ${error.message}`);
    items = data ?? [];
    resultCount = count ?? 0;
    totalPages = Math.max(1, Math.ceil(resultCount / pageSize));

    const ids = items.map((item) => item.id);
    if (realm.supabaseProject === "primary" && ids.length > 0) {
      const { data: images, error: imagesError } = await supabase.from("content_item_images")
        .select("*").in("content_item_id", ids).order("sort_order").order("created_at");
      if (imagesError) throw new Error(`Could not load ${realm.title} images: ${imagesError.message}`);
      imageRows = images ?? [];
    }
  }

  const imagesByItem = new Map<string, ContentImage>();
  imageRows.forEach((image) => { if (!imagesByItem.has(image.content_item_id)) imagesByItem.set(image.content_item_id, image); });
  const supabase = isSupabaseProjectConfigured(realm.supabaseProject) ? createSupabaseReadClient(realm.supabaseProject) : null;
  const storage = supabase?.storage.from("content-assets");
  const linkParams = new URLSearchParams();
  if (query) linkParams.set("q", query);
  selectedTags.forEach((tag) => linkParams.append("tag", tag));
  if (selectedMedium) linkParams.set("medium", selectedMedium);
  if (sort !== "newest") linkParams.set("sort", sort);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(linkParams);
    if (page > 1) next.set("page", String(page));
    const suffix = next.toString();
    return `/${realm.slug}${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="realm-main realm-content-main">
        <section className="realm-intro" aria-labelledby="realm-title">
          <p className="eyebrow">Studio Universe</p>
          <h1 id="realm-title">{realm.title}</h1>
          <div className="rule" aria-hidden="true" />
          <p>Browse stories, images, sound, and new work from this collection.</p>
        </section>

        {!isSupabaseProjectConfigured(realm.supabaseProject) ? (
          <p className="empty-state">This page is being prepared.</p>
        ) : (
          <>
            <form action={`/${realm.slug}`} className="art-filters realm-filters" method="get">
              <label className="art-search-field">Search by keyword
                <input defaultValue={query} maxLength={100} name="q" placeholder="Try a title, topic, or phrase" type="search" />
              </label>
              <label>Medium / format
                <select defaultValue={selectedMedium} name="medium">
                  <option value="">All formats</option>
                  {availableMediums.map((medium) => <option key={medium} value={medium}>{medium}</option>)}
                </select>
              </label>
              <label>Sort by
                <select defaultValue={sort} name="sort">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="title">Title A–Z</option>
                  <option value="title-desc">Title Z–A</option>
                  {realm.supabaseProject === "primary" && <>
                    <option value="views">Most viewed</option>
                    <option value="likes">Most liked</option>
                    <option value="comments">Most commented</option>
                  </>}
                </select>
              </label>
              {availableTags.length > 0 && (
                <fieldset className="tag-filters">
                  <legend>Filter by tags</legend>
                  <div className="tag-options">
                    {availableTags.map((tag) => (
                      <label className="tag-option" key={tag}>
                        <input defaultChecked={selectedTags.includes(tag)} name="tag" type="checkbox" value={tag} />{tag}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="filter-actions">
                <button className="button-secondary" type="submit">Apply filters</button>
                <Link className="clear-filters" href={`/${realm.slug}`}>Clear</Link>
              </div>
            </form>

            <div className="art-results-heading">
              <p>{resultCount} {resultCount === 1 ? "result" : "results"}</p>
              <p>Search matches complete words; every entered word must match.</p>
            </div>
            {items.length === 0 ? (
              <p className="empty-state art-empty-state">No matching content yet.</p>
            ) : (
              <div className="content-list realm-content-list">
                {items.map((item) => {
                  const image = imagesByItem.get(item.id);
                  const imageUrl = image && storage
                    ? storage.getPublicUrl(image.image_path).data.publicUrl
                    : item.media_type === "image" ? item.asset_url : null;
                  return (
                    <article className="content-card realm-content-card" key={item.id}>
                      {imageUrl && <Link className="realm-card-image" href={`/${realm.slug}/${item.id}`}><img alt={image?.alt_text || item.title} loading="lazy" src={imageUrl} /></Link>}
                      <div className="realm-card-copy">
                        <p className="eyebrow">{item.medium || item.media_type}</p>
                        <h2><Link href={`/${realm.slug}/${item.id}`}>{item.title}</Link></h2>
                        <time dateTime={item.created_at}>Added {new Date(item.created_at).toLocaleDateString()}</time>
                        {item.summary && <p className="content-summary">{item.summary}</p>}
                        <div className="art-tags">{item.tags.map((tag) => <span className="art-tag" key={tag}>{tag}</span>)}</div>
                        {realm.supabaseProject === "primary" && <p className="art-card-stats">{item.views_count} views · {item.likes_count} likes · {item.comments_count} comments</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {totalPages > 1 && (
              <nav className="pagination" aria-label="Content pages">
                {requestedPage > 1 ? <Link href={pageHref(requestedPage - 1)}>← Previous</Link> : <span />}
                <span>Page {Math.min(requestedPage, totalPages)} of {totalPages}</span>
                {requestedPage < totalPages ? <Link href={pageHref(requestedPage + 1)}>Next →</Link> : <span />}
              </nav>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
