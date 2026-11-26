"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRealm } from "@/features/landing/data/realms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function target(sectionSlug: string, itemId: string): string {
  const realm = getRealm(sectionSlug);
  if (!realm || realm.slug === "art" || realm.supabaseProject !== "primary" || !uuidPattern.test(itemId)) redirect("/");
  return `/${realm.slug}/${itemId}`;
}

async function signedIn(sectionSlug: string, itemId: string) {
  const path = target(sectionSlug, itemId);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  const { data: item, error } = await supabase.from("content_items").select("id")
    .eq("id", itemId).eq("section_slug", sectionSlug as "craft" | "manga" | "stories" | "anime" | "poem" | "soundtrack")
    .eq("is_published", true).maybeSingle();
  if (error) throw new Error(`Could not load page content: ${error.message}`);
  if (!item) throw new Error("This page content is unavailable.");
  return { supabase, user, path };
}

async function ensureCanInteract(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data: profile, error } = await supabase.from("profiles").select("is_restricted").eq("id", userId).single();
  if (error) throw new Error(`Could not check your account status: ${error.message}`);
  if (profile.is_restricted) redirect("/notifications?restricted=1");
}

export async function toggleContentLikeAction(formData: FormData) {
  const itemId = String(formData.get("content_item_id") ?? "");
  const sectionSlug = String(formData.get("section_slug") ?? "");
  const { supabase, user, path } = await signedIn(sectionSlug, itemId);
  const { data: existing, error: lookupError } = await supabase.from("content_item_likes")
    .select("content_item_id").eq("content_item_id", itemId).eq("user_id", user.id).maybeSingle();
  if (lookupError) throw new Error(`Could not check your like: ${lookupError.message}`);

  if (existing) {
    const { error } = await supabase.from("content_item_likes").delete()
      .eq("content_item_id", itemId).eq("user_id", user.id);
    if (error) throw new Error(`Could not remove your like: ${error.message}`);
  } else {
    await ensureCanInteract(supabase, user.id);
    const { error } = await supabase.from("content_item_likes").insert({ content_item_id: itemId, user_id: user.id });
    if (error) throw new Error(`Could not like this item: ${error.message}`);
  }
  revalidatePath(path);
  revalidatePath(`/${sectionSlug}`);
  revalidatePath("/admin");
  redirect(path);
}

export async function addContentCommentAction(formData: FormData) {
  const itemId = String(formData.get("content_item_id") ?? "");
  const sectionSlug = String(formData.get("section_slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const { supabase, user, path } = await signedIn(sectionSlug, itemId);
  if (!body || body.length > 4000) throw new Error("Comments must be between 1 and 4,000 characters.");
  await ensureCanInteract(supabase, user.id);

  const { error } = await supabase.from("content_item_comments").insert({
    content_item_id: itemId,
    section_slug: sectionSlug as "craft" | "manga" | "stories" | "anime" | "poem" | "soundtrack",
    user_id: user.id,
    body,
  });
  if (error) throw new Error(`Could not post comment: ${error.message}`);
  revalidatePath(path);
  revalidatePath(`/${sectionSlug}`);
  revalidatePath("/admin");
  redirect(path);
}
