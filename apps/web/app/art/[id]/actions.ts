"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getSignedInUser(artworkId: string) {
  if (!uuidPattern.test(artworkId)) redirect("/art");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/art/${artworkId}`)}`);
  return { supabase, user };
}

async function ensureCanInteract(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_restricted")
    .eq("id", userId)
    .single();

  if (error) throw new Error(`Could not check your account status: ${error.message}`);
  if (profile.is_restricted) redirect("/notifications?restricted=1");
}

export async function toggleArtworkLikeAction(formData: FormData) {
  const artworkId = String(formData.get("artwork_id") ?? "");
  const { supabase, user } = await getSignedInUser(artworkId);

  const { data: existing, error: lookupError } = await supabase
    .from("artwork_likes")
    .select("artwork_id")
    .eq("artwork_id", artworkId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) throw new Error(`Could not check your like: ${lookupError.message}`);

  if (existing) {
    const { error } = await supabase
      .from("artwork_likes")
      .delete()
      .eq("artwork_id", artworkId)
      .eq("user_id", user.id);
    if (error) throw new Error(`Could not remove your like: ${error.message}`);
  } else {
    await ensureCanInteract(supabase, user.id);
    const { error } = await supabase.from("artwork_likes").insert({
      artwork_id: artworkId,
      user_id: user.id,
    });
    if (error) throw new Error(`Could not like artwork: ${error.message}`);
  }

  revalidatePath(`/art/${artworkId}`);
  revalidatePath("/art");
  redirect(`/art/${artworkId}`);
}

export async function addArtworkCommentAction(formData: FormData) {
  const artworkId = String(formData.get("artwork_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const { supabase, user } = await getSignedInUser(artworkId);

  if (!body || body.length > 4000) throw new Error("Comments must be between 1 and 4,000 characters.");
  await ensureCanInteract(supabase, user.id);

  const { error } = await supabase.from("artwork_comments").insert({
    artwork_id: artworkId,
    user_id: user.id,
    body,
  });

  if (error) throw new Error(`Could not post comment: ${error.message}`);

  revalidatePath(`/art/${artworkId}`);
  revalidatePath("/art");
  redirect(`/art/${artworkId}`);
}
