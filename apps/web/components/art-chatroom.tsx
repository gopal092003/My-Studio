"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";
import { reportCommunityContentAction } from "@/app/moderation/actions";
import { sendArtChatMessageAction } from "@/app/art/chatroom/actions";

type ChatMessage = Database["public"]["Tables"]["art_chat_messages"]["Row"];

export function ArtChatroom({
  initialMessages,
  userId,
  isRestricted,
  notice = "",
}: {
  initialMessages: ChatMessage[];
  userId: string;
  isRestricted: boolean;
  notice?: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState("Connecting…");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient("primary");
    let active = true;
    const channel = supabase
      .channel("art-chatroom-messages")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "art_chat_messages",
      }, (payload) => {
        const inserted = payload.new as ChatMessage;
        if (!active) return;
        setMessages((current) => current.some((message) => message.id === inserted.id)
          ? current
          : [...current, inserted].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-100));
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "art_chat_messages",
      }, (payload) => {
        const removed = payload.old as Partial<ChatMessage>;
        if (removed.id && active) setMessages((current) => current.filter((message) => message.id !== removed.id));
      })
      .subscribe((status) => {
        if (active) setConnection(status === "SUBSCRIBED" ? "Live" : status === "CHANNEL_ERROR" ? "Reconnecting…" : "Connecting…");
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    const formData = new FormData();
    formData.set("body", draft);
    startTransition(async () => {
      try {
        await sendArtChatMessageAction(formData);
        setDraft("");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not send the message.");
      }
    });
  }

  return (
    <section className="chatroom-panel" aria-label="Art chatroom">
      {notice && <p className="form-message" role="status">{notice}</p>}
      <div className="chatroom-guidelines">
        <p><strong>Be kind and keep it creative.</strong> Harassment, hate, threats, spam, and sharing private information are not allowed. Report messages for admin review.</p>
      </div>
      <div aria-live="polite" className="chatroom-status">{connection} · {messages.length} recent messages</div>
      <div className="chatroom-messages" aria-label="Recent Art chat messages" aria-live="polite">
        {messages.length === 0 ? (
          <p className="empty-state">The room is quiet. Start the conversation.</p>
        ) : messages.map((message) => (
          <article className="chat-message" key={message.id}>
            <div className="chat-message-byline">
              <strong>{message.author_name}</strong>
              <time dateTime={message.created_at}>{new Date(message.created_at).toISOString().replace("T", " ").slice(0, 16)} UTC</time>
            </div>
            <p>{message.body}</p>
            {message.user_id !== userId && (
              <details className="report-content">
                <summary>Report message</summary>
                <form action={reportCommunityContentAction}>
                  <input name="target_type" type="hidden" value="chat_message" />
                  <input name="target_id" type="hidden" value={message.id} />
                  <input name="return_to" type="hidden" value="/art/chatroom" />
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
        ))}
        <div ref={bottomRef} />
      </div>

      {isRestricted ? (
        <p className="empty-state">Your account is restricted from sending chat messages. <Link href="/notifications">View notification</Link></p>
      ) : (
        <form className="chatroom-compose" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="art-chat-message">Message</label>
          <textarea
            id="art-chat-message"
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Say hello…"
            required
            value={draft}
          />
          <button className="button-primary" disabled={isPending || !draft.trim()} type="submit">
            {isPending ? "Sending…" : "Send"}
          </button>
        </form>
      )}
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    </section>
  );
}
