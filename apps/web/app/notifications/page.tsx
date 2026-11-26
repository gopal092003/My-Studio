import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { markNotificationReadAction } from "./actions";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fnotifications");

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  const notifications: Notification[] = data ?? [];

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="notifications-main">
        <p className="eyebrow">Your account</p>
        <h1>Notifications</h1>
        <div className="notification-list">
          {notifications.length === 0 ? (
            <p className="empty-state">You have no notifications.</p>
          ) : notifications.map((notification) => (
            <article className={`notification-card ${notification.read_at ? "is-read" : "is-unread"}`} key={notification.id}>
              <p>{notification.message}</p>
              <div className="notification-meta">
                <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
                {notification.artwork_id && <Link href={`/art/${notification.artwork_id}`}>View artwork</Link>}
                {notification.content_item_id && notification.content_section_slug && (
                  <Link href={`/${notification.content_section_slug}/${notification.content_item_id}`}>View page content</Link>
                )}
                {!notification.read_at && (
                  <form action={markNotificationReadAction}>
                    <input name="notification_id" type="hidden" value={notification.id} />
                    <button className="text-button" type="submit">Mark read</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
