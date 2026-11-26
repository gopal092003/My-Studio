import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getRealm } from "@/features/landing/data/realms";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { Database } from "@/types/database";
import { closeModerationReportAction, deleteReportedContentAction, dismissModerationReportAction } from "./actions";

type Report = Database["public"]["Tables"]["moderation_reports"]["Row"];
type ArtworkComment = Pick<Database["public"]["Tables"]["artwork_comments"]["Row"], "id" | "author_name" | "body">;
type ContentComment = Pick<Database["public"]["Tables"]["content_item_comments"]["Row"], "id" | "author_name" | "body" | "content_item_id" | "section_slug">;
type ChatMessage = Pick<Database["public"]["Tables"]["art_chat_messages"]["Row"], "id" | "author_name" | "body">;
type Reporter = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "display_name" | "email">;

export const dynamic = "force-dynamic";

export default async function ModerationQueuePage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("moderation_reports").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Could not load moderation reports: ${error.message}`);
  const reports: Report[] = data ?? [];
  const artworkIds = reports.filter((report) => report.target_type === "artwork_comment").map((report) => report.target_id);
  const contentIds = reports.filter((report) => report.target_type === "content_item_comment").map((report) => report.target_id);
  const messageIds = reports.filter((report) => report.target_type === "chat_message").map((report) => report.target_id);
  const reporterIds = [...new Set(reports.map((report) => report.reporter_id))];
  const [artworkResult, contentResult, messagesResult, reportersResult] = await Promise.all([
    artworkIds.length > 0 ? supabase.from("artwork_comments").select("id, author_name, body").in("id", artworkIds)
      : Promise.resolve({ data: [] as ArtworkComment[], error: null }),
    contentIds.length > 0 ? supabase.from("content_item_comments").select("id, author_name, body, content_item_id, section_slug").in("id", contentIds)
      : Promise.resolve({ data: [] as ContentComment[], error: null }),
    messageIds.length > 0 ? supabase.from("art_chat_messages").select("id, author_name, body").in("id", messageIds)
      : Promise.resolve({ data: [] as ChatMessage[], error: null }),
    reporterIds.length > 0 ? supabase.from("profiles").select("id, display_name, email").in("id", reporterIds)
      : Promise.resolve({ data: [] as Reporter[], error: null }),
  ]);
  if (artworkResult.error) throw new Error(`Could not load reported artwork comments: ${artworkResult.error.message}`);
  if (contentResult.error) throw new Error(`Could not load reported page comments: ${contentResult.error.message}`);
  if (messagesResult.error) throw new Error(`Could not load reported chat messages: ${messagesResult.error.message}`);
  if (reportersResult.error) throw new Error(`Could not load report authors: ${reportersResult.error.message}`);
  const artworkById = new Map((artworkResult.data ?? []).map((item) => [item.id, item] as const));
  const contentById = new Map((contentResult.data ?? []).map((item) => [item.id, item] as const));
  const messagesById = new Map((messagesResult.data ?? []).map((item) => [item.id, item] as const));
  const reportersById = new Map((reportersResult.data ?? []).map((item) => [item.id, item] as const));
  const openCount = reports.filter((report) => report.status === "open").length;

  return <div className="page-shell">
    <SiteHeader />
    <main className="admin-main">
      <div className="admin-heading">
        <div><p className="eyebrow">Community safety</p><h1>Moderation queue</h1><p>{openCount} open {openCount === 1 ? "report" : "reports"} · latest 200 reports</p></div>
        <div className="admin-heading-links"><Link className="button-secondary" href="/admin">Content desk</Link><Link className="button-secondary" href="/admin/art">Artwork desk</Link><Link className="button-secondary" href="/art/chatroom">Art chatroom</Link></div>
      </div>
      {reports.length === 0 ? <p className="empty-state">No reports have been submitted.</p> : <div className="moderation-list">
        {reports.map((report) => {
          const artwork = report.target_type === "artwork_comment" ? artworkById.get(report.target_id) : undefined;
          const pageComment = report.target_type === "content_item_comment" ? contentById.get(report.target_id) : undefined;
          const message = report.target_type === "chat_message" ? messagesById.get(report.target_id) : undefined;
          const content = artwork ?? pageComment ?? message;
          const reporter = reportersById.get(report.reporter_id);
          const typeLabel = report.target_type === "artwork_comment" ? "Artwork comment" : report.target_type === "content_item_comment" ? "Page comment" : "Art chat message";
          const realm = pageComment ? getRealm(pageComment.section_slug) : undefined;
          return <article className="moderation-card" key={report.id}>
            <div className="moderation-card-heading"><div><p className="eyebrow">{typeLabel}</p><p className={`restriction-status ${report.status === "open" ? "is-restricted" : ""}`}>{report.status}</p></div><time dateTime={report.created_at}>{new Date(report.created_at).toLocaleString()}</time></div>
            <p className="moderation-reason"><strong>Reason:</strong> {report.reason}</p>
            <blockquote className="reported-content">{content ? <><strong>{content.author_name}</strong><br />{content.body}</> : "This content has already been removed."}</blockquote>
            {pageComment && realm && <p><Link href={`/admin/content/${pageComment.content_item_id}/comments`}>Open {realm.title} comment thread</Link></p>}
            <p className="moderation-reporter">Reported by {reporter?.display_name || reporter?.email || "a user"}</p>
            {report.status === "open" && <div className="moderation-actions">
              {content && <form action={deleteReportedContentAction}><input name="report_id" type="hidden" value={report.id} /><button className="button-danger" type="submit">Remove content and close report</button></form>}
              <form action={closeModerationReportAction}><input name="report_id" type="hidden" value={report.id} /><button className="button-secondary" type="submit">Keep content · mark reviewed</button></form>
              <form action={dismissModerationReportAction}><input name="report_id" type="hidden" value={report.id} /><button className="text-button" type="submit">Dismiss report</button></form>
            </div>}
            {report.handled_at && <p className="moderation-reporter">Handled {new Date(report.handled_at).toLocaleString()}</p>}
          </article>;
        })}
      </div>}
    </main>
    <SiteFooter />
  </div>;
}
