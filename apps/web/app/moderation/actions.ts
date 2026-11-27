"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid, safeInternalPath } from "@/lib/security/input";

function withFlag(path: string, flag: string): string {
  const url = new URL(path, "https://studio.invalid");
  url.searchParams.set(flag, "1");
  return `${url.pathname}${url.search}`;
}

export async function reportCommunityContentAction(formData: FormData) {
  const targetType = String(formData.get("target_type") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const returnPath = safeInternalPath(String(formData.get("return_to") ?? "/art"), "/art");
  const reason = [category, details].filter(Boolean).join(": ").slice(0, 500);

  if (!isUuid(targetId)) throw new Error("The reported item identifier is invalid.");
  if (targetType !== "artwork_comment" && targetType !== "chat_message" && targetType !== "content_item_comment") {
    throw new Error("Choose a valid report type.");
  }
  if (category.length < 3 || reason.length < 3) throw new Error("Choose a report reason.");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnPath)}`);

  const { error } = await supabase.from("moderation_reports").insert({
    target_type: targetType,
    target_id: targetId,
    reporter_id: user.id,
    reason,
  });

  if (error?.code === "23505") redirect(withFlag(returnPath, "already_reported"));
  if (error) throw new Error(`Could not send report: ${error.message}`);
  redirect(withFlag(returnPath, "reported"));
}
