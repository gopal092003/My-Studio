import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkGallery } from "@/components/artwork-gallery";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getRealm } from "@/features/landing/data/realms";
import { isSupabaseProjectConfigured } from "@/lib/supabase/config";
import {
  createSupabasePrimaryServiceClient,
  createSupabaseReadClient,
  createSupabaseServerClient,
  isViewTrackingConfigured,
} from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { reportCommunityContentAction } from "@/app/moderation/actions";
import { addContentCommentAction, toggleContentLikeAction } from "./actions";

type Item = Database["public"]["Tables"]["content_items"]["Row"];
type ItemComment = Database["public"]["Tables"]["content_item_comments"]["Row"];
type ItemImage = Database["public"]["Tables"]["content_item_images"]["Row"];
type DetailProps = { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ reported?: string; already_reported?: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: DetailProps) {
  const { slug, id } = await params;
  const realm = getRealm(slug);
  if (!realm || realm.slug === "art" || !uuidPattern.test(id) || !isSupabaseProjectConfigured(realm.supabaseProject)) return { title: "Page content" };
  const supabase = createSupabaseReadClient(realm.supabaseProject);
  const { data } = await supabase.from("content_items").select("title").eq("id", id).eq("section_slug", realm.slug).maybeSingle();
  return { title: data?.title ?? realm.title };
}

export default async function ContentItemDetailPage({ params, searchParams }: DetailProps) {
  const [{ slug, id }, queryParams] = await Promise.all([params, searchParams]);
  const realm = getRealm(slug);
  if (!realm || realm.slug === "art" || !uuidPattern.test(id) || !isSupabaseProjectConfigured(realm.supabaseProject)) notFound();

  const publicClient = createSupabaseReadClient(realm.supabaseProject);
  const { data: item, error: itemError } = await publicClient.from("content_items").select("*")
    .eq("id", id).eq("section_slug", realm.slug).eq("is_published", true).maybeSingle();
  if (!item) {
    if (itemError) throw new Error(`Could not load page content: ${itemError.message}`);
    notFound();
  }

  const isInteractive = realm.supabaseProject === "primary";
  const cookieStore = await cookies();
  const visitorId = cookieStore.get("page-content-visitor-id")?.value;
  let viewWasRecorded = false;
  if (isInteractive && visitorId && uuidPattern.test(visitorId) && isViewTrackingConfigured()) {
    const serviceClient = createSupabasePrimaryServiceClient();
    const { data, error } = await serviceClient.rpc("record_content_item_view", {
      p_content_item_id: item.id,
      p_visitor_id: visitorId,
    });
    if (error) throw new Error(`Could not record this page view: ${error.message}`);
    viewWasRecorded = data;
  }

  let comments: ItemComment[] = [];
  let images: ItemImage[] = [];
  let user: { id: string } | null = null;
  let isRestricted = false;
  let hasLiked = false;
  if (isInteractive) {
    const [{ data: commentRows, error: commentsError }, { data: imageRows, error: imagesError }, authResult] = await Promise.all([
      publicClient.from("content_item_comments").select("*").eq("content_item_id", id).order("created_at", { ascending: true }),
      publicClient.from("content_item_images").select("*").eq("content_item_id", id).order("sort_order").order("created_at"),
      createSupabaseServerClient().then((client) => client.auth.getUser()),
    ]);
    if (commentsError) throw new Error(`Could not load comments: ${commentsError.message}`);
    if (imagesError) throw new Error(`Could not load page images: ${imagesError.message}`);
    comments = commentRows ?? [];
    images = imageRows ?? [];
    user = authResult.data.user;
    if (user) {
      const authClient = await createSupabaseServerClient();
      const [{ data: profile, error: profileError }, { data: like, error: likeError }] = await Promise.all([
        authClient.from("profiles").select("is_restricted").eq("id", user.id).single(),
        authClient.from("content_item_likes").select("content_item_id").eq("content_item_id", id).eq("user_id", user.id).maybeSingle(),
      ]);
      if (profileError) throw new Error(`Could not load account status: ${profileError.message}`);
      if (likeError) throw new Error(`Could not load like status: ${likeError.message}`);
      isRestricted = profile.is_restricted;
      hasLiked = Boolean(like);
    }
  }

  const galleryImages = images.map((image) => ({
    id: image.id,
    src: publicClient.storage.from("content-assets").getPublicUrl(image.image_path).data.publicUrl,
    alt: image.alt_text || item.title,
  }));
  const commentsByParent = new Map<string, ItemComment[]>();
  comments.forEach((comment) => {
    if (comment.parent_comment_id) {
      const children = commentsByParent.get(comment.parent_comment_id) ?? [];
      children.push(comment);
      commentsByParent.set(comment.parent_comment_id, children);
    }
  });
  const rootComments = comments.filter((comment) => comment.parent_comment_id === null);
  const notice = queryParams.reported ? "Thanks. Your report was sent to the admin."
    : queryParams.already_reported ? "You have already reported that comment." : "";
  const itemPath = `/${realm.slug}/${item.id}`;

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="art-detail-main">
        <Link className="back-link" href={`/${realm.slug}`}>← Back to {realm.title}</Link>
        {notice && <p className="form-message" role="status">{notice}</p>}
        <article className="art-detail">
          <div className="art-gallery">
            {galleryImages.length > 0 ? <ArtworkGallery images={galleryImages} /> : item.media_type === "image" && item.asset_url ? (
              <div className="art-detail-image"><img alt={item.title} src={item.asset_url} /></div>
            ) : <div className="realm-detail-placeholder"><span>{realm.title}</span></div>}
          </div>
          <div className="art-detail-copy">
            <p className="eyebrow">{realm.title}</p>
            <h1>{item.title}</h1>
            <time dateTime={item.created_at}>Added {new Date(item.created_at).toLocaleDateString()}</time>
            {item.medium && <p className="art-detail-medium">Medium / format: {item.medium}</p>}
            {item.dimensions && <p className="art-detail-dimensions">Dimensions: {item.dimensions}</p>}
            {item.summary && <p className="art-detail-description">{item.summary}</p>}
            {item.body && <div className="art-detail-description content-item-body">{item.body}</div>}
            {item.asset_url && item.media_type === "audio" && <audio className="content-media-player" controls preload="metadata" src={item.asset_url}>Your browser does not support audio playback.</audio>}
            {item.asset_url && item.media_type === "video" && <video className="content-media-player" controls preload="metadata" src={item.asset_url}>Your browser does not support video playback.</video>}
            {item.asset_url && !["image", "audio", "video"].includes(item.media_type) && <p><a className="content-media-link" href={item.asset_url} rel="noreferrer" target="_blank">Open {item.media_type === "document" ? "document" : "media link"} ↗</a></p>}
            <div className="art-tags">{item.tags.map((tag) => <span className="art-tag" key={tag}>{tag}</span>)}</div>
            {isInteractive && <div className="art-detail-stats">
              <span>{item.views_count + Number(viewWasRecorded)} views</span>
              <span>{item.likes_count} likes</span>
              <span>{item.comments_count} comments</span>
            </div>}
            {isInteractive && (user ? (
              <div className="art-like-area">
                {isRestricted && !hasLiked ? <p className="form-error">Your account is restricted from interacting. <Link href="/notifications">View notification</Link></p> : (
                  <form action={toggleContentLikeAction}>
                    <input name="content_item_id" type="hidden" value={item.id} />
                    <input name="section_slug" type="hidden" value={realm.slug} />
                    <button className="button-secondary" type="submit">{hasLiked ? "Unlike" : "Like"}</button>
                  </form>
                )}
              </div>
            ) : <p className="art-like-area"><Link href={`/login?next=${encodeURIComponent(itemPath)}`}>Log in to like or comment</Link></p>)}
          </div>
        </article>

        {isInteractive && <section className="comments-section" aria-labelledby="comments-title">
          <div className="comments-heading"><h2 id="comments-title">Comments</h2><span>{item.comments_count}</span></div>
          {user && !isRestricted ? (
            <form action={addContentCommentAction} className="comment-form">
              <input name="content_item_id" type="hidden" value={item.id} />
              <input name="section_slug" type="hidden" value={realm.slug} />
              <label htmlFor="content-comment-body">Join the conversation</label>
              <textarea id="content-comment-body" maxLength={4000} name="body" placeholder="Write a comment…" required />
              <button className="button-primary" type="submit">Post comment</button>
            </form>
          ) : user ? <p className="empty-state">Your account is restricted from commenting. <Link href="/notifications">View notification</Link></p>
            : <p className="empty-state"><Link href={`/login?next=${encodeURIComponent(itemPath)}`}>Log in</Link> to comment.</p>}
          {rootComments.length === 0 ? <p className="empty-state">No comments yet.</p> : (
            <div className="comment-list">
              {rootComments.map((comment) => <div className="comment-thread" key={comment.id}>
                <Comment item={item} comment={comment} userId={user?.id} />
                {(commentsByParent.get(comment.id) ?? []).map((reply) => <Comment className="comment-reply" item={item} comment={reply} key={reply.id} userId={user?.id} />)}
              </div>)}
            </div>
          )}
        </section>}
      </main>
      <SiteFooter />
    </div>
  );
}

function Comment({ item, comment, userId, className = "" }: { item: Item; comment: ItemComment; userId?: string; className?: string }) {
  return <article className={`art-comment ${className}`}>
    <div className="comment-byline"><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString()}</time></div>
    <p>{comment.body}</p>
    {userId && userId !== comment.user_id && <details className="report-content">
      <summary>Report comment</summary>
      <form action={reportCommunityContentAction}>
        <input name="target_type" type="hidden" value="content_item_comment" />
        <input name="target_id" type="hidden" value={comment.id} />
        <input name="return_to" type="hidden" value={`/${item.section_slug}/${item.id}`} />
        <label>Reason<select name="category" required>
          <option value="">Choose a reason</option><option value="Harassment">Harassment</option><option value="Hate speech">Hate speech</option>
          <option value="Threats">Threats</option><option value="Spam">Spam</option><option value="Private information">Private information</option><option value="Other">Other</option>
        </select></label>
        <textarea maxLength={400} name="details" placeholder="Add context (optional)" />
        <button className="text-button" type="submit">Send report</button>
      </form>
    </details>}
  </article>;
}
