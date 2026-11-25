import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { realms, type SupabaseProject } from "@/features/landing/data/realms";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isSupabaseProjectConfigured } from "@/lib/supabase/config";
import { createSupabaseSecondaryAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { deleteContentAction, saveContentAction, signOutAction } from "./actions";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
type ManagedContent = ContentItem & { databaseProject: SupabaseProject };

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, user } = await requireAdmin();
  const items: ManagedContent[] = [];

  const { data: primaryItems, error: primaryError } = await supabase
    .from("content_items")
    .select("*")
    .order("updated_at", { ascending: false });

  if (primaryError) throw new Error(`Could not load admin content: ${primaryError.message}`);
  items.push(...(primaryItems ?? []).map((item) => ({ ...item, databaseProject: "primary" as const })));

  if (isSupabaseProjectConfigured("secondary")) {
    const secondary = createSupabaseSecondaryAdminClient();
    const { data: secondaryItems, error: secondaryError } = await secondary
      .from("content_items")
      .select("*")
      .order("updated_at", { ascending: false });

    if (secondaryError) throw new Error(`Could not load secondary content: ${secondaryError.message}`);
    items.push(...(secondaryItems ?? []).map((item) => ({ ...item, databaseProject: "secondary" as const })));
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Studio Universe</p>
            <h1>Content desk</h1>
            <p>Signed in as {user.email}</p>
          </div>
          <div className="admin-heading-links">
            <Link className="button-secondary" href="/admin/art">Manage Art</Link>
            <form action={signOutAction}>
              <button className="button-secondary" type="submit">Log out</button>
            </form>
          </div>
        </div>

        <h2 className="admin-section-title">Add content</h2>
        <ContentForm />

        <h2 className="admin-section-title">Published and draft content</h2>
        {items.length === 0 ? (
          <p className="empty-state">No content yet. Add an item above to get started.</p>
        ) : (
          <div className="content-admin-list">
            {items.map((item) => (
              <article className="content-admin-card" key={`${item.databaseProject}-${item.id}`}>
                <div className="content-admin-meta">
                  <span>{item.databaseProject} project · {item.is_published ? "Published" : "Draft"}</span>
                  <span>Updated {new Date(item.updated_at).toLocaleDateString()}</span>
                </div>
                <ContentForm item={item} databaseProject={item.databaseProject} />
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ContentForm({ item, databaseProject }: { item?: ContentItem; databaseProject?: SupabaseProject }) {
  const nonArtRealms = realms.filter((realm) => realm.slug !== "art");
  const eligibleRealms = item && databaseProject
    ? [
        ...nonArtRealms.filter((realm) => realm.supabaseProject === databaseProject),
        ...(item.section_slug === "art" ? [realms.find((realm) => realm.slug === "art")] : []),
      ].filter((realm): realm is (typeof realms)[number] => Boolean(realm))
    : nonArtRealms;

  return (
    <form action={saveContentAction} className="content-form">
      {item && <input name="id" type="hidden" value={item.id} />}
      {databaseProject && <input name="database_project" type="hidden" value={databaseProject} />}
      <label>
        Page
        <select defaultValue={item?.section_slug ?? "craft"} name="section_slug" required>
          {eligibleRealms.map((realm) => <option key={realm.slug} value={realm.slug}>{realm.title}</option>)}
        </select>
      </label>
      <label>
        Title
        <input defaultValue={item?.title ?? ""} maxLength={180} name="title" required />
      </label>
      <label className="field-wide">
        Short description
        <input defaultValue={item?.summary ?? ""} maxLength={500} name="summary" />
      </label>
      <label className="field-wide">
        Text
        <textarea defaultValue={item?.body ?? ""} name="body" />
      </label>
      <label className="field-wide">
        Media URL (optional)
        <input defaultValue={item?.asset_url ?? ""} name="asset_url" type="url" />
      </label>
      <label className="published-field">
        <input defaultChecked={item?.is_published ?? false} name="is_published" type="checkbox" />
        Publish this item
      </label>
      <div className="content-form-actions">
        <button className="button-primary" type="submit">{item ? "Save changes" : "Add content"}</button>
        {item && (
          <button
            className="button-danger"
            formAction={deleteContentAction}
            name="delete"
            type="submit"
            value="delete"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
