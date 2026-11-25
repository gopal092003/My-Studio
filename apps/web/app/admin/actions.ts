"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRealm, type SupabaseProject } from "@/features/landing/data/realms";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  createSupabaseSecondaryAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getProject(value: string, fallback: SupabaseProject): SupabaseProject {
  return value === "primary" || value === "secondary" ? value : fallback;
}

function mutationClient(project: SupabaseProject, primaryClient: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  return project === "primary" ? primaryClient : createSupabaseSecondaryAdminClient();
}

export async function saveContentAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = field(formData, "id");
  const sectionSlug = field(formData, "section_slug");
  const realm = getRealm(sectionSlug);

  if (!realm) throw new Error("Choose a valid site section.");

  const project = id
    ? getProject(field(formData, "database_project"), realm.supabaseProject)
    : realm.supabaseProject;
  const title = field(formData, "title");

  if (!title) throw new Error("A title is required.");

  const values = {
    section_slug: realm.slug,
    title,
    summary: field(formData, "summary") || null,
    body: field(formData, "body") || null,
    asset_url: field(formData, "asset_url") || null,
    is_published: formData.get("is_published") === "on",
  };
  const client = mutationClient(project, supabase);

  const result = id
    ? await client.from("content_items").update(values).eq("id", id)
    : await client.from("content_items").insert({ ...values, created_by: user.id });

  if (result.error) throw new Error(`Could not save content: ${result.error.message}`);

  revalidatePath(`/${realm.slug}`);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteContentAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = field(formData, "id");
  const sectionSlug = field(formData, "section_slug");
  const realm = getRealm(sectionSlug);

  if (!id || !realm) throw new Error("Choose a valid content item.");

  const project = getProject(field(formData, "database_project"), realm.supabaseProject);
  const client = mutationClient(project, supabase);
  const { error } = await client.from("content_items").delete().eq("id", id);

  if (error) throw new Error(`Could not delete content: ${error.message}`);

  revalidatePath(`/${realm.slug}`);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
