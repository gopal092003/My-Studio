import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isSupabaseProjectConfigured } from "@/lib/supabase/config";
import { createSupabaseReadClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Artwork = Database["public"]["Tables"]["artworks"]["Row"];

type ArtSearchParams = {
  q?: string;
  tag?: string | string[];
  medium?: string;
  sort?: string;
  page?: string;
};

const pageSize = 24;
const sortOptions = {
  newest: { label: "Newest", field: "created_at", ascending: false },
  oldest: { label: "Oldest", field: "created_at", ascending: true },
  name_asc: { label: "Name: A to Z", field: "name_sort", ascending: true },
  name_desc: { label: "Name: Z to A", field: "name_sort", ascending: false },
  views: { label: "Most viewed", field: "views_count", ascending: false },
  likes: { label: "Most liked", field: "likes_count", ascending: false },
  comments: { label: "Most commented", field: "comments_count", ascending: false },
} as const;

export const dynamic = "force-dynamic";

export default async function ArtPage({
  searchParams,
}: {
  searchParams: Promise<ArtSearchParams>;
}) {
  const params = await searchParams;
  const queryText = params.q?.trim().slice(0, 100) ?? "";
  const selectedTags = [...new Set((Array.isArray(params.tag) ? params.tag : params.tag ? [params.tag] : [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean))];
  const selectedMedium = params.medium?.trim() ?? "";
  const sortKey = params.sort && params.sort in sortOptions
    ? (params.sort as keyof typeof sortOptions)
    : "newest";
  const sort = sortOptions[sortKey];
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let artworks: Artwork[] = [];
  let totalCount = 0;
  let availableTags: string[] = [];
  let availableMediums: string[] = [];

  if (isSupabaseProjectConfigured("primary")) {
    const supabase = createSupabaseReadClient("primary");
    const { data: tagsData, error: tagsError } = await supabase
      .from("artworks")
      .select("tags, medium")
      .eq("is_visible", true);

    if (tagsError) throw new Error(`Could not load artwork tags: ${tagsError.message}`);
    availableTags = [...new Set((tagsData ?? []).flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b));
    availableMediums = [...new Set((tagsData ?? []).map((item) => item.medium).filter((medium): medium is string => Boolean(medium)))].sort((a, b) => a.localeCompare(b));

    let request = supabase
      .from("artworks")
      .select("*", { count: "exact" })
      .eq("is_visible", true);

    if (queryText) {
      request = request.textSearch("search_document", queryText, { config: "simple", type: "plain" });
    }
    if (selectedTags.length > 0) {
      request = request.overlaps("tags", selectedTags);
    }
    if (selectedMedium) request = request.eq("medium", selectedMedium);

    const offset = (page - 1) * pageSize;
    const { data, error, count } = await request
      .order(sort.field, { ascending: sort.ascending })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Could not load artwork: ${error.message}`);
    artworks = data ?? [];
    totalCount = count ?? 0;
  }

  const storage = isSupabaseProjectConfigured("primary")
    ? createSupabaseReadClient("primary").storage.from("artworks")
    : undefined;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (queryText) next.set("q", queryText);
    if (selectedMedium) next.set("medium", selectedMedium);
    selectedTags.forEach((tag) => next.append("tag", tag));
    if (sortKey !== "newest") next.set("sort", sortKey);
    if (targetPage > 1) next.set("page", String(targetPage));
    const query = next.toString();
    return query ? `/art?${query}` : "/art";
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="art-main">
        <section className="art-intro" aria-labelledby="art-title">
          <p className="eyebrow">The visual collection</p>
          <h1 id="art-title">Art</h1>
          <div className="rule" aria-hidden="true" />
        </section>

        <form action="/art" className="art-filters" method="get">
          <label className="art-search-field">
            Search by exact keyword
            <input autoComplete="off" defaultValue={queryText} maxLength={100} name="q" placeholder="Name, description, medium, dimensions, or tag" />
          </label>
          <label>
            Sort by
            <select defaultValue={sortKey} name="sort">
              {Object.entries(sortOptions).map(([value, option]) => (
                <option key={value} value={value}>{option.label}</option>
              ))}
            </select>
          </label>
          {availableMediums.length > 0 && (
            <label>
              Filter by medium
              <select defaultValue={selectedMedium} name="medium">
                <option value="">All mediums</option>
                {availableMediums.map((medium) => <option key={medium} value={medium}>{medium}</option>)}
              </select>
            </label>
          )}
          {availableTags.length > 0 && (
            <fieldset className="tag-filters">
              <legend>Filter by tags (matches any selected tag)</legend>
              <div className="tag-options">
                {availableTags.map((tag) => (
                  <label className="tag-option" key={tag}>
                    <input defaultChecked={selectedTags.includes(tag)} name="tag" type="checkbox" value={tag} />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="filter-actions">
            <button className="button-primary" type="submit">Apply filters</button>
            <Link className="clear-filters" href="/art">Clear</Link>
          </div>
        </form>

        <div className="art-results-heading">
          <p>{totalCount} {totalCount === 1 ? "artwork" : "artworks"}</p>
          <div className="art-community-links">
            <Link href="/art/chatroom">Art chatroom</Link>
            <Link href="/admin/art">Admin: manage artwork</Link>
          </div>
        </div>

        {artworks.length === 0 ? (
          <p className="empty-state art-empty-state">No artwork matches these filters yet.</p>
        ) : (
          <div className="art-grid">
            {artworks.map((artwork) => {
              const imageUrl = storage?.getPublicUrl(artwork.image_path).data.publicUrl;
              return (
                <article className="art-card" key={artwork.id}>
                  <Link className="art-card-image" href={`/art/${artwork.id}`} prefetch={false}>
                    {imageUrl && <img alt={artwork.name} loading="lazy" src={imageUrl} />}
                  </Link>
                  <div className="art-card-copy">
                    <h2><Link href={`/art/${artwork.id}`} prefetch={false}>{artwork.name}</Link></h2>
                    <time dateTime={artwork.created_at}>{new Date(artwork.created_at).toLocaleDateString()}</time>
                    {artwork.medium && <p className="art-card-medium">{artwork.medium}</p>}
                    {artwork.description && <p className="art-card-description">{artwork.description}</p>}
                    <div className="art-tags">
                      {artwork.tags.map((tag) => <span className="art-tag" key={tag}>{tag}</span>)}
                    </div>
                    <p className="art-card-stats">
                      {artwork.views_count} views · {artwork.likes_count} likes · {artwork.comments_count} comments
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Artwork pages">
            {page > 1 ? <Link href={pageHref(page - 1)}>← Previous</Link> : <span />}
            <span>Page {page} of {totalPages}</span>
            {page < totalPages ? <Link href={pageHref(page + 1)}>Next →</Link> : <span />}
          </nav>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

