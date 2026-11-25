"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function sendArtChatMessageAction(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 2000) throw new Error("Messages must be between 1 and 2,000 characters.");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fart%2Fchatroom");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_restricted")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error(`Could not check account status: ${profileError.message}`);
  if (profile.is_restricted) throw new Error("Your account is restricted from sending chat messages. Check your notifications.");

  const { error } = await supabase.from("art_chat_messages").insert({ user_id: user.id, body });
  if (error) throw new Error(`Could not send chat message: ${error.message}`);
  revalidatePath("/art/chatroom");
}
