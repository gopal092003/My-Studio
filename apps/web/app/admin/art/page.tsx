import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArtworkEditor } from "@/components/artwork-editor";
import { BulkArtworkUpload } from "@/components/bulk-artwork-upload";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseReadClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Artwork = Database["public"]["Tables"]["artworks"]["Row"];

export const dynamic = "force-dynamic";

export default async function AdminArtPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load artworks: ${error.message}`);
  const artworks = data ?? [];
  const { data: imageRows, error: imagesError } = await supabase
    .from("artwork_images")
    .select("id, artwork_id, image_path, alt_text, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (imagesError) throw new Error(`Could not load artwork images: ${imagesError.message}`);
  const publicStorage = createSupabaseReadClient("primary").storage.from("artworks");
  const imagesByArtwork = new Map<string, typeof imageRows>();
  (imageRows ?? []).forEach((image) => {
    const current = imagesByArtwork.get(image.artwork_id) ?? [];
    current.push(image);
    imagesByArtwork.set(image.artwork_id, current);
  });

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Art collection</p>
            <h1>Artwork desk</h1>
            <p>Add, edit, hide, or remove artwork. New entries are visible by default.</p>
          </div>
          <div className="admin-heading-links">
            <Link className="button-secondary" href="/admin/moderation">Moderation queue</Link>
            <Link className="button-secondary" href="/admin/art/users">Manage users</Link>
          </div>
        </div>

        <h2 className="admin-section-title">Add artwork</h2>
        <article className="content-admin-card">
          <ArtworkEditor id={randomUUID()} key="new-artwork" />
        </article>

        <h2 className="admin-section-title">Bulk upload</h2>
        <article className="content-admin-card">
          <BulkArtworkUpload />
        </article>

        <h2 className="admin-section-title">Existing artwork</h2>
        {artworks.length === 0 ? (
          <p className="empty-state">No artwork has been added yet.</p>
        ) : (
          <div className="content-admin-list">
            {artworks.map((artwork: Artwork) => {
              const imageUrl = publicStorage.getPublicUrl(artwork.image_path).data.publicUrl;
              const imagePreviews = (imagesByArtwork.get(artwork.id) ?? []).map((image) => ({
                id: image.id,
                src: publicStorage.getPublicUrl(image.image_path).data.publicUrl,
                alt: image.alt_text,
              }));
              const scheduledAt = artwork.scheduled_publish_at ? new Date(artwork.scheduled_publish_at) : null;
              let status = artwork.is_visible ? "Published" : "Hidden";
              if (artwork.is_visible && scheduledAt && scheduledAt.getTime() > Date.now()) {
                status = `Scheduled · ${scheduledAt.toLocaleString()}`;
              }
              return (
                <article className="content-admin-card" key={artwork.id}>
                  <div className="content-admin-meta">
                    <span>{status} · Added {new Date(artwork.created_at).toLocaleDateString()}</span>
                    <span>{artwork.views_count} views · {artwork.likes_count} likes · {artwork.comments_count} comments</span>
                  </div>
                  <ArtworkEditor artwork={artwork} id={artwork.id} imagePreviews={imagePreviews.length > 0 ? imagePreviews : [{ id: artwork.id, src: imageUrl, alt: artwork.name }]} key={`${artwork.id}-${artwork.updated_at}`} />
                  <p className="artwork-comments-link"><Link href={`/admin/art/${artwork.id}/comments`}>Manage comments and replies</Link></p>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
