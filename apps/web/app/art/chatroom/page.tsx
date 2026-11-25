import Link from "next/link";
import { redirect } from "next/navigation";
import { ArtChatroom } from "@/components/art-chatroom";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ChatMessage = Database["public"]["Tables"]["art_chat_messages"]["Row"];

export const dynamic = "force-dynamic";

export default async function ArtChatroomPage({
  searchParams,
}: {
  searchParams: Promise<{ reported?: string; already_reported?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fart%2Fchatroom");

  const [{ data: profile, error: profileError }, { data: messagesData, error: messagesError }] = await Promise.all([
    supabase.from("profiles").select("is_restricted").eq("id", user.id).single(),
    supabase.from("art_chat_messages").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  if (profileError) throw new Error(`Could not load account status: ${profileError.message}`);
  if (messagesError) throw new Error(`Could not load chat messages: ${messagesError.message}`);

  const params = await searchParams;
  const notice = params.reported
    ? "Thanks. Your report was sent to the admin."
    : params.already_reported
      ? "You have already reported that message."
      : "";

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="chatroom-main">
        <Link className="back-link" href="/art">← Back to Art</Link>
        <header className="chatroom-heading">
          <p className="eyebrow">Art community</p>
          <h1>Art — chatroom</h1>
          <p>Meet other visitors and talk about art, ideas, and what you’re making.</p>
        </header>
        <ArtChatroom
          initialMessages={(messagesData ?? []).reverse() as ChatMessage[]}
          isRestricted={profile.is_restricted}
          notice={notice}
          userId={user.id}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
