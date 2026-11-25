import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ArtworkGallery } from "@/components/artwork-gallery";
import { addArtworkCommentAction, toggleArtworkLikeAction } from "./actions";
import { reportCommunityContentAction } from "@/app/moderation/actions";
import {
  createSupabaseServerClient,
  createSupabasePrimaryServiceClient,
  createSupabaseReadClient,
  isArtworkViewTrackingConfigured,
} from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Artwork = Database["public"]["Tables"]["artworks"]["Row"];
type ArtworkComment = Database["public"]["Tables"]["artwork_comments"]["Row"];
type ArtworkImage = Database["public"]["Tables"]["artwork_images"]["Row"];
type DetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reported?: string; already_reported?: string }>;
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: DetailPageProps) {
  const { id } = await params;
  if (!uuidPattern.test(id)) return { title: "Artwork" };

  const supabase = createSupabaseReadClient("primary");
  const { data } = await supabase.from("artworks").select("name").eq("id", id).eq("is_visible", true).maybeSingle();
  return { title: data?.name ?? "Artwork" };
}

export default async function ArtworkDetailPage({ params, searchParams }: DetailPageProps) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const publicClient = createSupabaseReadClient("primary");
  const { data: artwork, error: artworkError } = await publicClient
    .from("artworks")
    .select("*")
    .eq("id", id)
    .eq("is_visible", true)
    .maybeSingle();

  if (!artwork) {
    if (artworkError) throw new Error(`Could not load artwork: ${artworkError.message}`);
    notFound();
  }

  const cookieStore = await cookies();
  const visitorId = cookieStore.get("artwork-visitor-id")?.value;
  let viewWasRecorded = false;

  if (visitorId && uuidPattern.test(visitorId) && isArtworkViewTrackingConfigured()) {
    const serviceClient = createSupabasePrimaryServiceClient();
    const { data, error } = await serviceClient.rpc("record_artwork_view", {
      p_artwork_id: artwork.id,
      p_visitor_id: visitorId,
    });
    if (error) throw new Error(`Could not record artwork view: ${error.message}`);
    viewWasRecorded = data;
  }

  const [
    { data: comments, error: commentsError },
    { data: imagesData, error: imagesError },
    authResult,
  ] = await Promise.all([
    publicClient
      .from("artwork_comments")
      .select("*")
      .eq("artwork_id", id)
      .order("created_at", { ascending: true }),
    publicClient
      .from("artwork_images")
      .select("*")
      .eq("artwork_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    createSupabaseServerClient().then((client) => client.auth.getUser()),
  ]);

  if (commentsError) throw new Error(`Could not load comments: ${commentsError.message}`);
  if (imagesError) throw new Error(`Could not load artwork images: ${imagesError.message}`);
  const user = authResult.data.user;
  let isRestricted = false;
  let hasLiked = false;

  if (user) {
    const authClient = await createSupabaseServerClient();
    const [{ data: profile, error: profileError }, { data: like, error: likeError }] = await Promise.all([
      authClient.from("profiles").select("is_restricted").eq("id", user.id).single(),
      authClient.from("artwork_likes").select("artwork_id").eq("artwork_id", id).eq("user_id", user.id).maybeSingle(),
    ]);

    if (profileError) throw new Error(`Could not load account status: ${profileError.message}`);
    if (likeError) throw new Error(`Could not load like status: ${likeError.message}`);
    isRestricted = profile.is_restricted;
    hasLiked = Boolean(like);
  }

  const storage = publicClient.storage.from("artworks");
  const availableImages = (imagesData ?? []).length > 0
    ? imagesData as ArtworkImage[]
    : [{ id: artwork.id, artwork_id: artwork.id, image_path: artwork.image_path, alt_text: artwork.name, sort_order: 0, created_at: artwork.created_at }];
  const galleryImages = availableImages.map((image) => ({
    id: image.id,
    src: storage.getPublicUrl(image.image_path).data.publicUrl,
    alt: image.alt_text || artwork.name,
  }));
  const roots = (comments ?? []).filter((comment) => comment.parent_comment_id === null);
  const repliesByParent = new Map<string, ArtworkComment[]>();
  (comments ?? []).forEach((comment) => {
    if (comment.parent_comment_id) {
      const replies = repliesByParent.get(comment.parent_comment_id) ?? [];
      replies.push(comment);
      repliesByParent.set(comment.parent_comment_id, replies);
    }
  });
  const params = await searchParams;
  const notice = params.reported
    ? "Thanks. Your report was sent to the admin."
    : params.already_reported
      ? "You have already reported that comment."
      : "";

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="art-detail-main">
        <Link className="back-link" href="/art">← Back to Art</Link>
        {notice && <p className="form-message" role="status">{notice}</p>}
        <article className="art-detail">
          <ArtworkGallery images={galleryImages} />
          <div className="art-detail-copy">
            <p className="eyebrow">Artwork</p>
            <h1>{artwork.name}</h1>
            <time dateTime={artwork.created_at}>Added {new Date(artwork.created_at).toLocaleDateString()}</time>
            {artwork.medium && <p className="art-detail-medium">Medium: {artwork.medium}</p>}
            {artwork.dimensions && <p className="art-detail-dimensions">Dimensions: {artwork.dimensions}</p>}
            {artwork.description && <p className="art-detail-description">{artwork.description}</p>}
            <div className="art-tags">
              {artwork.tags.map((tag) => <span className="art-tag" key={tag}>{tag}</span>)}
            </div>
            <div className="art-detail-stats">
              <span>{artwork.views_count + Number(viewWasRecorded)} views</span>
              <span>{artwork.likes_count} likes</span>
              <span>{artwork.comments_count} comments</span>
            </div>

            {user ? (
              <div className="art-like-area">
                {isRestricted && !hasLiked ? (
                  <p className="form-error">Your account is restricted from interacting. <Link href="/notifications">View notification</Link></p>
                ) : (
                  <form action={toggleArtworkLikeAction}>
                    <input name="artwork_id" type="hidden" value={artwork.id} />
                    <button className="button-secondary" type="submit">{hasLiked ? "Unlike" : "Like artwork"}</button>
                  </form>
                )}
              </div>
            ) : (
              <p className="art-like-area"><Link href={`/login?next=${encodeURIComponent(`/art/${artwork.id}`)}`}>Log in to like or comment</Link></p>
            )}
          </div>
        </article>

        <section className="comments-section" aria-labelledby="comments-title">
          <div className="comments-heading">
            <h2 id="comments-title">Comments</h2>
            <span>{artwork.comments_count}</span>
          </div>

          {user && !isRestricted ? (
            <form action={addArtworkCommentAction} className="comment-form">
              <input name="artwork_id" type="hidden" value={artwork.id} />
              <label htmlFor="comment-body">Join the conversation</label>
              <textarea id="comment-body" maxLength={4000} name="body" placeholder="Write a comment…" required />
              <button className="button-primary" type="submit">Post comment</button>
            </form>
          ) : user ? (
            <p className="empty-state">Your account is restricted from commenting. <Link href="/notifications">View notification</Link></p>
          ) : (
            <p className="empty-state"><Link href={`/login?next=${encodeURIComponent(`/art/${artwork.id}`)}`}>Log in</Link> to comment on artwork.</p>
          )}

          {roots.length === 0 ? (
            <p className="empty-state">No comments yet.</p>
          ) : (
            <div className="comment-list">
              {roots.map((comment) => (
                <div className="comment-thread" key={comment.id}>
                  <Comment artworkId={artwork.id} comment={comment} userId={user?.id} />
                  {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                    <Comment artworkId={artwork.id} className="comment-reply" comment={reply} key={reply.id} userId={user?.id} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Comment({
  comment,
  artworkId,
  userId,
  className = "",
}: {
  comment: ArtworkComment;
  artworkId: string;
  userId?: string;
  className?: string;
}) {
  return (
    <article className={`art-comment ${className}`}>
      <div className="comment-byline">
        <strong>{comment.author_name}</strong>
        <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString()}</time>
      </div>
      <p>{comment.body}</p>
      {userId && userId !== comment.user_id && (
        <details className="report-content">
          <summary>Report comment</summary>
          <form action={reportCommunityContentAction}>
            <input name="target_type" type="hidden" value="artwork_comment" />
            <input name="target_id" type="hidden" value={comment.id} />
            <input name="return_to" type="hidden" value={`/art/${artworkId}`} />
            <label>Reason
              <select name="category" required>
                <option value="">Choose a reason</option>
                <option value="Harassment">Harassment</option>
                <option value="Hate speech">Hate speech</option>
                <option value="Threats">Threats</option>
                <option value="Spam">Spam</option>
                <option value="Private information">Private information</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <textarea maxLength={400} name="details" placeholder="Add context (optional)" />
            <button className="text-button" type="submit">Send report</button>
          </form>
        </details>
      )}
    </article>
  );
}
