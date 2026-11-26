import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ContentItemEditor } from "@/components/content-item-editor";
import { realms, type SupabaseProject } from "@/features/landing/data/realms";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isSupabaseProjectConfigured } from "@/lib/supabase/config";
import { createSupabaseSecondaryAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { signOutAction } from "./actions";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
type ContentImage = Database["public"]["Tables"]["content_item_images"]["Row"];
type ManagedContent = ContentItem & {
  databaseProject: SupabaseProject;
  imagePreviews: { id: string; src: string; alt: string }[];
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, user } = await requireAdmin();
  const items: ManagedContent[] = [];
  const { data: primaryItems, error: primaryError } = await supabase.from("content_items").select("*").neq("section_slug", "art").order("updated_at", { ascending: false });
  if (primaryError) throw new Error(`Could not load admin content: ${primaryError.message}`);
  const primaryIds = (primaryItems ?? []).map((item) => item.id);
  const primaryImagesResult = primaryIds.length > 0
    ? await supabase.from("content_item_images").select("*").in("content_item_id", primaryIds).order("sort_order")
    : { data: [] as ContentImage[], error: null };
  if (primaryImagesResult.error) throw new Error(`Could not load content images: ${primaryImagesResult.error.message}`);
  const primaryImages = new Map<string, ContentImage[]>();
  (primaryImagesResult.data ?? []).forEach((image) => {
    const list = primaryImages.get(image.content_item_id) ?? [];
    list.push(image);
    primaryImages.set(image.content_item_id, list);
  });
  items.push(...(primaryItems ?? []).map((item) => ({
    ...item,
    databaseProject: "primary" as const,
    imagePreviews: (primaryImages.get(item.id) ?? []).map((image) => ({
      id: image.id,
      src: supabase.storage.from("content-assets").getPublicUrl(image.image_path).data.publicUrl,
      alt: image.alt_text || item.title,
    })),
  })));

  if (isSupabaseProjectConfigured("secondary")) {
    const secondary = createSupabaseSecondaryAdminClient();
    const { data: secondaryItems, error: secondaryError } = await secondary.from("content_items").select("*").neq("section_slug", "art").order("updated_at", { ascending: false });
    if (secondaryError) throw new Error(`Could not load secondary content: ${secondaryError.message}`);
    items.push(...(secondaryItems ?? []).map((item) => ({ ...item, databaseProject: "secondary" as const, imagePreviews: [] })));
  }

  const groups: SupabaseProject[] = isSupabaseProjectConfigured("secondary") ? ["primary", "secondary"] : ["primary"];
  const titleForSlug = (slug: string) => realms.find((realm) => realm.slug === slug)?.title ?? slug;
  const projectTitle = (project: SupabaseProject) => project === "primary" ? "Primary project" : "Secondary project";

  return <div className="page-shell">
    <SiteHeader />
    <main className="admin-main">
      <div className="admin-heading">
        <div><p className="eyebrow">Studio Universe</p><h1>Content desk</h1><p>Signed in as {user.email}</p></div>
        <div className="admin-heading-links">
          <Link className="button-secondary" href="/admin/art">Manage Art</Link>
          <Link className="button-secondary" href="/admin/moderation">Moderation queue</Link>
          <form action={signOutAction}><button className="button-secondary" type="submit">Log out</button></form>
        </div>
      </div>

      {groups.map((project) => {
        const projectRealms = realms.filter((realm) => realm.slug !== "art" && realm.supabaseProject === project);
        const projectItems = items.filter((item) => item.databaseProject === project);
        if (projectRealms.length === 0 && projectItems.length === 0) return null;
        const primarySection = projectRealms[0]?.slug ?? "craft";
        return <section className="admin-project-section" key={project}>
          <h2 className="admin-section-title">{projectTitle(project)} · {projectRealms.map((realm) => realm.title).join(", ") || "No pages assigned"}</h2>
          {projectRealms.length > 0 && <div className="content-admin-card">
            <h3 className="admin-subheading">Add content</h3>
            <ContentItemEditor id={crypto.randomUUID()} databaseProject={project} canUploadImages={project === "primary"} defaultSectionSlug={primarySection} />
          </div>}
          <h3 className="admin-subheading">Content items</h3>
          {projectItems.length === 0 ? <p className="empty-state">No content yet.</p> : <div className="content-admin-list">
            {projectItems.map((item) => <article className="content-admin-card" key={`${project}-${item.id}`}>
              <div className="content-admin-meta">
                <span>{titleForSlug(item.section_slug)} · {item.is_published ? "Published" : "Hidden"}{item.scheduled_publish_at && ` · Scheduled ${new Date(item.scheduled_publish_at).toLocaleString()}`}</span>
                <span>Added {new Date(item.created_at).toLocaleDateString()} · Updated {new Date(item.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="admin-item-links">
                <Link href={`/${item.section_slug}/${item.id}`}>Open page</Link>
                {project === "primary" && <Link href={`/admin/content/${item.id}/comments`}>Manage comments ({item.comments_count})</Link>}
              </div>
              {project === "secondary" && <p className="field-help">Secondary-project content is public and editable here. Likes, comments, views, and image uploads use primary-project accounts and are disabled for this section.</p>}
              <ContentItemEditor id={item.id} item={item} databaseProject={project} imagePreviews={item.imagePreviews} canUploadImages={project === "primary"} />
            </article>)}
          </div>}
        </section>;
      })}
      <p className="field-help admin-dashboard-note">Analytics dashboard is on hold. Use the moderation queue to review reports.</p>
    </main>
    <SiteFooter />
  </div>;
}
