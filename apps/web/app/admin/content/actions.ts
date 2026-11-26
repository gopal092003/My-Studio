"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRealm } from "@/features/landing/data/realms";
import { requireAdmin } from "@/lib/auth/require-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function addAdminContentReplyAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const itemId = field(formData, "content_item_id");
  const parentCommentId = field(formData, "parent_comment_id");
  const body = field(formData, "body");
  if (!uuidPattern.test(itemId) || !uuidPattern.test(parentCommentId)) throw new Error("The content or comment identifier is invalid.");
  if (!body || body.length > 4000) throw new Error("Replies must be between 1 and 4,000 characters.");

  const { data: item, error: itemError } = await supabase.from("content_items").select("section_slug").eq("id", itemId).maybeSingle();
  if (itemError || !item) throw new Error(`Could not load content item${itemError ? `: ${itemError.message}` : "."}`);
  const realm = getRealm(item.section_slug);
  if (!realm || realm.slug === "art" || realm.supabaseProject !== "primary") throw new Error("This page does not support content comments.");
  const { data: parent, error: parentError } = await supabase.from("content_item_comments")
    .select("id, parent_comment_id").eq("id", parentCommentId).eq("content_item_id", itemId).maybeSingle();
  if (parentError || !parent || parent.parent_comment_id) throw new Error("Replies can only be attached to a comment on this page.");

  const { error } = await supabase.from("content_item_comments").insert({
    content_item_id: itemId,
    section_slug: item.section_slug,
    user_id: user.id,
    parent_comment_id: parentCommentId,
    body,
  });
  if (error) throw new Error(`Could not post reply: ${error.message}`);
  revalidatePath(`/${item.section_slug}/${itemId}`);
  revalidatePath(`/admin/content/${itemId}/comments`);
  revalidatePath("/admin");
  redirect(`/admin/content/${itemId}/comments`);
}

export async function deleteContentCommentAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const itemId = field(formData, "content_item_id");
  const commentId = field(formData, "comment_id");
  if (!uuidPattern.test(itemId) || !uuidPattern.test(commentId)) throw new Error("The content or comment identifier is invalid.");
  const { data: item, error: itemError } = await supabase.from("content_items").select("section_slug").eq("id", itemId).maybeSingle();
  if (itemError || !item) throw new Error(`Could not load content item${itemError ? `: ${itemError.message}` : "."}`);
  const { error } = await supabase.rpc("admin_delete_content_item_comment", { p_comment_id: commentId });
  if (error) throw new Error(`Could not remove comment: ${error.message}`);
  revalidatePath(`/${item.section_slug}/${itemId}`);
  revalidatePath(`/admin/content/${itemId}/comments`);
  revalidatePath("/admin");
  revalidatePath("/admin/moderation");
  revalidatePath("/notifications");
  redirect(`/admin/content/${itemId}/comments`);
}
