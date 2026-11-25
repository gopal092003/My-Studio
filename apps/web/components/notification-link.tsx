"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSupabaseProjectConfigured } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function NotificationLink() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isSupabaseProjectConfigured("primary")) return;

    const supabase = createSupabaseBrowserClient("primary");
    let active = true;
    let notificationChannel: ReturnType<typeof supabase.channel> | undefined;

    async function updateCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setUnreadCount(0);
        return;
      }

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);

      if (active) setUnreadCount(count ?? 0);
    }

    async function connectNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (notificationChannel) {
        await supabase.removeChannel(notificationChannel);
        notificationChannel = undefined;
      }
      if (!user) {
        setUnreadCount(0);
        return;
      }

      await updateCount();
      if (!active) return;
      notificationChannel = supabase
        .channel(`notifications-${user.id}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        }, () => void updateCount())
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        }, () => void updateCount())
        .subscribe();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void connectNotifications(), 0);
    });
    void connectNotifications();

    return () => {
      active = false;
      subscription.unsubscribe();
      if (notificationChannel) void supabase.removeChannel(notificationChannel);
    };
  }, []);

  return (
    <Link href="/notifications">
      Notifications{unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
    </Link>
  );
}
