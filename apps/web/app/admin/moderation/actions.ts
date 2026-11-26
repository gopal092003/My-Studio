"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function resolveReport(reportId: string, status: "reviewed" | "dismissed") {
  const { supabase, user } = await requireAdmin();
  if (!uuidPattern.test(reportId)) throw new Error("The report identifier is invalid.");

  const { data, error } = await supabase
    .from("moderation_reports")
    .update({ status, handled_by: user.id, handled_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not update report: ${error.message}`);
  if (!data) throw new Error("This report has already been handled.");

  revalidatePath("/admin/moderation");
  revalidatePath("/notifications");
}

export async function dismissModerationReportAction(formData: FormData) {
  await resolveReport(field(formData, "report_id"), "dismissed");
  redirect("/admin/moderation");
}

export async function closeModerationReportAction(formData: FormData) {
  await resolveReport(field(formData, "report_id"), "reviewed");
  redirect("/admin/moderation");
}

export async function deleteReportedContentAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const reportId = field(formData, "report_id");
  if (!uuidPattern.test(reportId)) throw new Error("The report identifier is invalid.");

  const { data: report, error: reportError } = await supabase
    .from("moderation_reports")
    .select("id, target_type, target_id, status")
    .eq("id", reportId)
    .single();
  if (reportError) throw new Error(`Could not load report: ${reportError.message}`);
  if (report.status !== "open") throw new Error("This report has already been handled.");

  const removal = report.target_type === "artwork_comment"
    ? await supabase.rpc("admin_delete_artwork_comment", { p_comment_id: report.target_id })
    : report.target_type === "content_item_comment"
      ? await supabase.rpc("admin_delete_content_item_comment", { p_comment_id: report.target_id })
      : await supabase.rpc("admin_delete_art_chat_message", { p_message_id: report.target_id });
  if (removal.error) throw new Error(`Could not remove reported content: ${removal.error.message}`);

  const { error: updateError } = await supabase
    .from("moderation_reports")
    .update({ status: "reviewed", handled_by: user.id, handled_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "open");
  if (updateError) throw new Error(`Content was removed, but the report could not be closed: ${updateError.message}`);

  revalidatePath("/admin/moderation");
  revalidatePath("/art");
  revalidatePath("/art/chatroom");
  revalidatePath("/admin");
  revalidatePath("/notifications");
  redirect("/admin/moderation");
}
