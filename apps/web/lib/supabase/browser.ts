"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseProject } from "@/features/landing/data/realms";
import type { Database } from "@/types/database";
import { getSupabaseProjectConfig } from "./config";

export function createSupabaseBrowserClient(project: SupabaseProject = "primary") {
  const { url, publishableKey } = getSupabaseProjectConfig(project);
  return createBrowserClient<Database>(url, publishableKey);
}
