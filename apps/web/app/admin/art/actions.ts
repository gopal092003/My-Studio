"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

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

function parseImagePaths(value: string, artworkId: string): string[] {
  if (!value) return [];
  let paths: unknown;
  try {
    paths = JSON.parse(value);
  } catch {
    throw new Error("The uploaded artwork image list is invalid.");
  }

  if (!Array.isArray(paths) || paths.length > 20 || paths.some((path) =>
    typeof path !== "string" || !path.startsWith(`${artworkId}/`),
  )) {
    throw new Error("Choose between 1 and 20 valid artwork images.");
  }
  return [...new Set(paths)];
}

function scheduledTimestamp(value: string, isVisible: boolean): string | null {
  if (!isVisible || !value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Choose a valid publish date and time.");
  if (date.getTime() <= Date.now()) throw new Error("The publish time must be in the future.");
  return date.toISOString();
}

export async function saveArtworkAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = field(formData, "id");
  const name = field(formData, "name");
  const imagePaths = parseImagePaths(field(formData, "image_paths"), id);

  if (!uuidPattern.test(id)) throw new Error("The artwork identifier is invalid.");
  if (!name) throw new Error("An artwork name is required.");

  const { data: existing, error: lookupError } = await supabase
    .from("artworks")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) throw new Error(`Could not load artwork: ${lookupError.message}`);
  const imagePath = imagePaths[0] ?? existing?.image_path ?? field(formData, "image_path");
  if (!imagePath || !imagePath.startsWith(`${id}/`)) {
    throw new Error("Upload an artwork image before saving.");
  }

  const visibility = formData.get("is_visible") === "on";
  const scheduledPublishAt = scheduledTimestamp(field(formData, "scheduled_publish_at"), visibility);
  let oldImagePaths: string[] = [];
  if (existing && imagePaths.length > 0) {
    const { data: images, error: imagesError } = await supabase
      .from("artwork_images")
      .select("image_path")
      .eq("artwork_id", id);
    if (imagesError) throw new Error(`Could not load existing images: ${imagesError.message}`);
    oldImagePaths = [...new Set([existing.image_path, ...(images ?? []).map((image) => image.image_path)])];
  }

  const values = {
    name,
    description: field(formData, "description").slice(0, 5000) || null,
    medium: field(formData, "medium").slice(0, 100) || null,
    dimensions: field(formData, "dimensions").slice(0, 100) || null,
    tags: normalizeTags(field(formData, "tags")),
    image_path: existing?.image_path ?? imagePath,
    is_visible: visibility,
    scheduled_publish_at: scheduledPublishAt,
  };

  const result = existing
    ? await supabase.from("artworks").update(values).eq("id", id)
    : await supabase.from("artworks").insert({ ...values, id, created_by: user.id });

  if (result.error) throw new Error(`Could not save artwork: ${result.error.message}`);

  if (imagePaths.length > 0) {
    const { error: replaceError } = await supabase.rpc("admin_replace_artwork_images", {
      p_artwork_id: id,
      p_image_paths: imagePaths,
    });
    if (replaceError) {
      if (!existing) await supabase.from("artworks").delete().eq("id", id);
      throw new Error(`Could not save artwork images: ${replaceError.message}`);
    }
    const replacedPaths = oldImagePaths.filter((path) => !imagePaths.includes(path));
    if (replacedPaths.length > 0) await supabase.storage.from("artworks").remove(replacedPaths);
  }

  revalidatePath("/art");
  revalidatePath(`/art/${id}`);
  revalidatePath("/admin/art");
  revalidatePath("/art/chatroom");
}

export async function bulkCreateArtworksAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  let uploadedItems: unknown;
  try {
    uploadedItems = JSON.parse(field(formData, "items"));
  } catch {
    throw new Error("The bulk upload list is invalid.");
  }
  if (!Array.isArray(uploadedItems) || uploadedItems.length < 1 || uploadedItems.length > 25) {
    throw new Error("Upload between 1 and 25 artwork images at a time.");
  }

  const items = uploadedItems.map((item) => {
    if (!item || typeof item !== "object") throw new Error("The bulk upload list is invalid.");
    const record = item as { id?: unknown; name?: unknown; image_path?: unknown };
    const id = String(record.id ?? "");
    const name = String(record.name ?? "").trim().slice(0, 180);
    const imagePath = String(record.image_path ?? "");
    if (!uuidPattern.test(id) || !name || !imagePath.startsWith(`${id}/`)) {
      throw new Error("An uploaded artwork item is invalid.");
    }
    return { id, name, image_path: imagePath };
  });
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("The bulk upload contains duplicate identifiers.");

  const tags = normalizeTags(field(formData, "tags"));
  const medium = field(formData, "medium").slice(0, 100) || null;
  const { error: insertError } = await supabase.from("artworks").insert(items.map((item) => ({
    id: item.id,
    name: item.name,
    image_path: item.image_path,
    medium,
    tags,
    is_visible: true,
    created_by: user.id,
  })));

  if (insertError) throw new Error(`Could not create bulk artwork: ${insertError.message}`);

  const imageResults = await Promise.all(items.map((item) => supabase.rpc("admin_replace_artwork_images", {
    p_artwork_id: item.id,
    p_image_paths: [item.image_path],
  })));
  const failedImageResult = imageResults.find((result) => result.error);
  if (failedImageResult?.error) {
    await supabase.from("artworks").delete().in("id", ids);
    await supabase.storage.from("artworks").remove(items.map((item) => item.image_path));
    throw new Error(`Could not finish bulk image setup: ${failedImageResult.error.message}`);
  }

  revalidatePath("/art");
  revalidatePath("/admin/art");
}

export async function deleteArtworkAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = field(formData, "id");

  if (!uuidPattern.test(id)) throw new Error("The artwork identifier is invalid.");

  const { data: artwork, error: lookupError } = await supabase
    .from("artworks")
    .select("image_path")
    .eq("id", id)
    .single();

  if (lookupError) throw new Error(`Could not load artwork: ${lookupError.message}`);

  const { data: images, error: imagesError } = await supabase
    .from("artwork_images")
    .select("image_path")
    .eq("artwork_id", id);
  if (imagesError) throw new Error(`Could not load artwork images: ${imagesError.message}`);

  const { error } = await supabase.from("artworks").delete().eq("id", id);
  if (error) throw new Error(`Could not delete artwork: ${error.message}`);

  const imagePaths = [artwork.image_path, ...(images ?? []).map((image) => image.image_path)];
  await supabase.storage.from("artworks").remove([...new Set(imagePaths)]);
  revalidatePath("/art");
  revalidatePath(`/art/${id}`);
  revalidatePath("/admin/art");
  revalidatePath("/notifications");
  redirect("/admin/art");
}

export async function addAdminArtworkReplyAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const artworkId = field(formData, "artwork_id");
  const parentCommentId = field(formData, "parent_comment_id");
  const body = field(formData, "body");

  if (!uuidPattern.test(artworkId) || !uuidPattern.test(parentCommentId)) {
    throw new Error("The artwork or comment identifier is invalid.");
  }
  if (!body || body.length > 4000) throw new Error("Replies must be between 1 and 4,000 characters.");

  const { error } = await supabase.from("artwork_comments").insert({
    artwork_id: artworkId,
    user_id: user.id,
    parent_comment_id: parentCommentId,
    body,
  });

  if (error) throw new Error(`Could not post reply: ${error.message}`);

  revalidatePath(`/art/${artworkId}`);
  revalidatePath(`/admin/art/${artworkId}/comments`);
  redirect(`/admin/art/${artworkId}/comments`);
}

export async function deleteArtworkCommentAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const artworkId = field(formData, "artwork_id");
  const commentId = field(formData, "comment_id");

  if (!uuidPattern.test(artworkId) || !uuidPattern.test(commentId)) {
    throw new Error("The artwork or comment identifier is invalid.");
  }

  const { error } = await supabase.rpc("admin_delete_artwork_comment", {
    p_comment_id: commentId,
  });

  if (error) throw new Error(`Could not remove comment: ${error.message}`);

  revalidatePath(`/art/${artworkId}`);
  revalidatePath(`/admin/art/${artworkId}/comments`);
  revalidatePath("/notifications");
  redirect(`/admin/art/${artworkId}/comments`);
}

export async function setUserRestrictionAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = field(formData, "user_id");
  const restricted = field(formData, "restricted") === "true";
  const reason = field(formData, "reason").slice(0, 500);

  if (!uuidPattern.test(userId)) throw new Error("The user identifier is invalid.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      is_restricted: restricted,
      restriction_reason: restricted ? reason || null : null,
    })
    .eq("id", userId)
    .eq("role", "user")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not update restriction: ${error.message}`);
  if (!data) throw new Error("Only a regular user can be restricted.");

  revalidatePath("/admin/art/users");
  revalidatePath("/notifications");
  redirect("/admin/art/users");
}
