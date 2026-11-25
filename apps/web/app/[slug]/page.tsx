import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getRealm } from "@/features/landing/data/realms";
import { isSupabaseProjectConfigured } from "@/lib/supabase/config";
import { createSupabaseReadClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];

type RealmPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: RealmPageProps): Promise<Metadata> {
  const { slug } = await params;
  const realm = getRealm(slug);

  if (!realm) return {};
  return { title: realm.title };
}

export default async function RealmPage({ params }: RealmPageProps) {
  const { slug } = await params;
  const realm = getRealm(slug);

  if (!realm) notFound();

  const project = realm.supabaseProject;
  let contentItems: ContentItem[] = [];

  if (isSupabaseProjectConfigured(project)) {
    const supabase = createSupabaseReadClient(project);
    const { data, error } = await supabase
      .from("content_items")
      .select("*")
      .eq("section_slug", realm.slug)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Could not load ${realm.title} content: ${error.message}`);
    contentItems = data ?? [];
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="realm-main">
        <section aria-labelledby="realm-title">
          <p className="eyebrow">Studio Universe</p>
          <h1 id="realm-title">{realm.title}</h1>
          <div className="rule" aria-hidden="true" />
        </section>
        <div className="content-list">
          {contentItems.length === 0 ? (
            <p className="empty-state">New content will appear here soon.</p>
          ) : contentItems.map((item) => (
            <article className="content-card" key={item.id}>
              <h2>{item.title}</h2>
              {item.summary && <p className="content-summary">{item.summary}</p>}
              {item.body && <p>{item.body}</p>}
              {item.asset_url && <p><a href={item.asset_url}>Open media</a></p>}
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
