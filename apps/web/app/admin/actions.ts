"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRealm, type SupabaseProject } from "@/features/landing/data/realms";
import type { ContentSection } from "@/types/database";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseSecondaryAdminClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
    .slice(0, 20)
    .map((tag) => tag.slice(0, 32));
}

function resolveProject(value: string): SupabaseProject {
  if (value === "primary" || value === "secondary") return value;
  return "primary";
}

function scheduledTimestamp(value: string, isPublished: boolean): string | null {
  if (!isPublished || !value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Choose a valid publish date and time.");
  if (date.getTime() <= Date.now()) throw new Error("The publish time must be in the future.");
  return date.toISOString();
}

function revalidateContent(sectionSlug: string, id: string) {
  revalidatePath(`/${sectionSlug}`);
  revalidatePath(`/${sectionSlug}/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/moderation");
  revalidatePath("/notifications");
}

export async function saveContentAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = field(formData, "id");
  const sectionSlug = field(formData, "section_slug");
  const title = field(formData, "title").slice(0, 180);
  const realm = getRealm(sectionSlug);
  const databaseProject = resolveProject(field(formData, "database_project"));

  if (!uuidPattern.test(id)) throw new Error("The content identifier is invalid.");
  if (!realm || realm.slug === "art" || realm.supabaseProject !== databaseProject) {
    throw new Error("Choose a page assigned to this Supabase project.");
  }
  if (!title) throw new Error("A title is required.");

  const isPublished = formData.get("is_published") === "on";
  const scheduledPublishAt = scheduledTimestamp(field(formData, "scheduled_publish_at"), isPublished);
  const mediaType = field(formData, "media_type") || "text";
  const allowedMediaTypes = ["text", "image", "audio", "video", "document", "external"];
  if (!allowedMediaTypes.includes(mediaType)) throw new Error("Choose a valid content format.");
  const assetUrl = field(formData, "asset_url");
  if (assetUrl) {
    let parsedUrl: URL;
    try { parsedUrl = new URL(assetUrl); } catch { throw new Error("Enter a valid media URL."); }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") throw new Error("Media links must use HTTP or HTTPS.");
  }

  const pathsValue = field(formData, "image_paths");
  let imagePaths: string[] = [];
  if (pathsValue) {
    let parsed: unknown;
    try { parsed = JSON.parse(pathsValue); } catch { throw new Error("The uploaded image list is invalid."); }
    if (!Array.isArray(parsed) || parsed.length > 20 || parsed.some((path) =>
      typeof path !== "string" || !path.startsWith(`${sectionSlug}/${id}/`),
    )) throw new Error("Choose up to 20 valid images for this content item.");
    imagePaths = [...new Set(parsed as string[])];
  }
  if (databaseProject === "secondary" && imagePaths.length > 0) {
    throw new Error("Image uploads are enabled for primary-project pages only.");
  }

  const db = databaseProject === "primary" ? supabase : createSupabaseSecondaryAdminClient();
  const { data: existing, error: lookupError } = await db
    .from("content_items")
    .select("section_slug")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new Error(`Could not load content: ${lookupError.message}`);
  if (existing && existing.section_slug !== sectionSlug) throw new Error("This content item belongs to another page.");

  let oldImagePaths: string[] = [];
  if (databaseProject === "primary" && existing && imagePaths.length > 0) {
    const { data: oldImages, error: imageError } = await supabase
      .from("content_item_images")
      .select("image_path")
      .eq("content_item_id", id);
    if (imageError) throw new Error(`Could not load current images: ${imageError.message}`);
    oldImagePaths = (oldImages ?? []).map((image) => image.image_path);
  }

  const values = {
    section_slug: sectionSlug as ContentSection,
    title,
    summary: field(formData, "summary").slice(0, 5000) || null,
    body: field(formData, "body").slice(0, 50000) || null,
    asset_url: assetUrl || null,
    tags: normalizeTags(field(formData, "tags")),
    medium: field(formData, "medium").slice(0, 100) || null,
    dimensions: field(formData, "dimensions").slice(0, 100) || null,
    media_type: mediaType as "text" | "image" | "audio" | "video" | "document" | "external",
    is_published: isPublished,
    scheduled_publish_at: scheduledPublishAt,
    updated_at: new Date().toISOString(),
  };
  const result = existing
    ? await db.from("content_items").update(values).eq("id", id)
    : await db.from("content_items").insert({
        ...values,
        id,
        created_by: databaseProject === "primary" ? user.id : null,
      });
  if (result.error) throw new Error(`Could not save content: ${result.error.message}`);

  if (databaseProject === "primary" && imagePaths.length > 0) {
    const { error: imageReplaceError } = await supabase.rpc("admin_replace_content_item_images", {
      p_content_item_id: id,
      p_image_paths: imagePaths,
      p_section_slug: sectionSlug as ContentSection,
    });
    if (imageReplaceError) {
      if (!existing) await supabase.from("content_items").delete().eq("id", id);
      throw new Error(`Content saved, but images could not be linked: ${imageReplaceError.message}`);
    }
    const replacedPaths = oldImagePaths.filter((path) => !imagePaths.includes(path));
    if (replacedPaths.length > 0) await supabase.storage.from("content-assets").remove(replacedPaths);
  }

  revalidateContent(sectionSlug, id);
}

export async function deleteContentAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = field(formData, "id");
  const sectionSlug = field(formData, "section_slug");
  const databaseProject = resolveProject(field(formData, "database_project"));
  const realm = getRealm(sectionSlug);
  if (!uuidPattern.test(id) || !realm || realm.slug === "art" || realm.supabaseProject !== databaseProject) {
    throw new Error("The content item is invalid.");
  }

  const db = databaseProject === "primary" ? supabase : createSupabaseSecondaryAdminClient();
  let imagePaths: string[] = [];
  if (databaseProject === "primary") {
    const { data: images, error: imageError } = await supabase
      .from("content_item_images")
      .select("image_path")
      .eq("content_item_id", id);
    if (imageError) throw new Error(`Could not load content images: ${imageError.message}`);
    imagePaths = (images ?? []).map((image) => image.image_path);
  }
  const { error } = await db.from("content_items").delete().eq("id", id).eq("section_slug", sectionSlug as ContentSection);
  if (error) throw new Error(`Could not delete content: ${error.message}`);
  if (imagePaths.length > 0) await supabase.storage.from("content-assets").remove(imagePaths);

  revalidateContent(sectionSlug, id);
  redirect("/admin");
}

export async function signOutAction() {
  const { supabase } = await requireAdmin();
  await supabase.auth.signOut();
  redirect("/");
}
