import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { Database } from "@/types/database";
import { addAdminArtworkReplyAction, deleteArtworkCommentAction } from "../../actions";

type ArtworkComment = Database["public"]["Tables"]["artwork_comments"]["Row"];
type CommentsPageProps = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function ArtworkCommentsPage({ params }: CommentsPageProps) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const { supabase } = await requireAdmin();
  const [{ data: artwork, error: artworkError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from("artworks").select("id, name, is_visible").eq("id", id).maybeSingle(),
    supabase.from("artwork_comments").select("*").eq("artwork_id", id).order("created_at", { ascending: true }),
  ]);

  if (artworkError) throw new Error(`Could not load artwork: ${artworkError.message}`);
  if (!artwork) notFound();
  if (commentsError) throw new Error(`Could not load comments: ${commentsError.message}`);

  const allComments: ArtworkComment[] = comments ?? [];
  const roots = allComments.filter((comment) => comment.parent_comment_id === null);
  const repliesByParent = new Map<string, ArtworkComment[]>();
  allComments.forEach((comment) => {
    if (comment.parent_comment_id) {
      const replies = repliesByParent.get(comment.parent_comment_id) ?? [];
      replies.push(comment);
      repliesByParent.set(comment.parent_comment_id, replies);
    }
  });

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">{artwork.is_visible ? "Visible artwork" : "Hidden artwork"}</p>
            <h1>Comments</h1>
            <p>{artwork.name}</p>
          </div>
          <div className="admin-heading-links">
            <Link className="button-secondary" href="/admin/art">Artwork desk</Link>
            {artwork.is_visible && <Link className="button-secondary" href={`/art/${id}`}>View artwork</Link>}
          </div>
        </div>

        {roots.length === 0 ? (
          <p className="empty-state">No comments on this artwork.</p>
        ) : (
          <div className="comment-list admin-comment-list">
            {roots.map((comment) => (
              <div className="admin-comment-thread" key={comment.id}>
                <AdminComment comment={comment} artworkId={id} />
                {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                  <AdminComment className="comment-reply" comment={reply} artworkId={id} key={reply.id} />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function AdminComment({
  comment,
  artworkId,
  className = "",
}: {
  comment: ArtworkComment;
  artworkId: string;
  className?: string;
}) {
  return (
    <article className={`admin-comment ${className}`}>
      <div className="comment-byline">
        <strong>{comment.author_name}</strong>
        <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
      </div>
      <p>{comment.body}</p>
      <div className="admin-comment-actions">
        {comment.parent_comment_id === null && (
          <form action={addAdminArtworkReplyAction} className="admin-reply-form">
            <input name="artwork_id" type="hidden" value={artworkId} />
            <input name="parent_comment_id" type="hidden" value={comment.id} />
            <textarea maxLength={4000} name="body" placeholder="Reply as admin…" required />
            <button className="button-secondary" type="submit">Reply</button>
          </form>
        )}
        <form action={deleteArtworkCommentAction}>
          <input name="artwork_id" type="hidden" value={artworkId} />
          <input name="comment_id" type="hidden" value={comment.id} />
          <button className="text-button danger-text" type="submit">Delete comment</button>
        </form>
      </div>
    </article>
  );
}
