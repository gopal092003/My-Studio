import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { Database } from "@/types/database";
import { addAdminContentReplyAction, deleteContentCommentAction } from "../../actions";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
type ContentComment = Database["public"]["Tables"]["content_item_comments"]["Row"];
type PageProps = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function ContentCommentsPage({ params }: PageProps) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data: item, error: itemError } = await supabase.from("content_items").select("*").eq("id", id).maybeSingle();
  if (itemError) throw new Error(`Could not load content item: ${itemError.message}`);
  if (!item || item.section_slug === "art") notFound();
  const { data, error } = await supabase.from("content_item_comments").select("*")
    .eq("content_item_id", id).order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load comments: ${error.message}`);
  const comments: ContentComment[] = data ?? [];
  const roots = comments.filter((comment) => !comment.parent_comment_id);
  const replies = new Map<string, ContentComment[]>();
  comments.forEach((comment) => {
    if (comment.parent_comment_id) {
      const group = replies.get(comment.parent_comment_id) ?? [];
      group.push(comment);
      replies.set(comment.parent_comment_id, group);
    }
  });

  return <div className="page-shell">
    <SiteHeader />
    <main className="admin-main">
      <Link className="back-link" href="/admin">← Back to content desk</Link>
      <p className="eyebrow">{item.section_slug} · Community moderation</p>
      <h1 className="admin-page-title">{item.title}</h1>
      <p className="admin-page-description">Review comments, reply as the admin, or remove comments. Removed users receive an in-app notification.</p>
      <div className="admin-comment-list">
        {roots.length === 0 ? <p className="empty-state">No comments yet.</p> : roots.map((comment) => <article className="admin-comment-thread" key={comment.id}>
          <AdminComment comment={comment} item={item} />
          {(replies.get(comment.id) ?? []).map((reply) => <AdminComment comment={reply} item={item} key={reply.id} />)}
          <div className="admin-comment-actions">
            <form action={addAdminContentReplyAction} className="admin-reply-form">
              <input name="content_item_id" type="hidden" value={item.id} />
              <input name="parent_comment_id" type="hidden" value={comment.id} />
              <label className="sr-only" htmlFor={`reply-${comment.id}`}>Reply as admin</label>
              <textarea id={`reply-${comment.id}`} maxLength={4000} name="body" placeholder="Reply as admin…" required />
              <button className="button-secondary" type="submit">Post reply</button>
            </form>
            <form action={deleteContentCommentAction}>
              <input name="content_item_id" type="hidden" value={item.id} />
              <input name="comment_id" type="hidden" value={comment.id} />
              <button className="button-danger" type="submit">Delete thread</button>
            </form>
          </div>
        </article>)}
      </div>
    </main>
    <SiteFooter />
  </div>;
}

function AdminComment({ comment, item }: { comment: ContentComment; item: ContentItem }) {
  return <div className={comment.parent_comment_id ? "admin-comment admin-comment-reply" : "admin-comment"}>
    <div className="comment-byline"><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time></div>
    <p>{comment.body}</p>
    <form action={deleteContentCommentAction} className="admin-single-comment-delete">
      <input name="content_item_id" type="hidden" value={item.id} />
      <input name="comment_id" type="hidden" value={comment.id} />
      <button className="text-button danger-text" type="submit">Delete comment</button>
    </form>
  </div>;
}
