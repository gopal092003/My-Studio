import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { SupabaseProject } from "@/features/landing/data/realms";
import type { Database } from "@/types/database";
import { getSupabaseProjectConfig } from "./config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseProjectConfig("primary");

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; middleware refreshes sessions.
        }
      },
    },
  });
}

export function createSupabaseReadClient(project: SupabaseProject) {
  const { url, publishableKey } = getSupabaseProjectConfig(project);

  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function createSupabaseSecondaryAdminClient() {
  const { url } = getSupabaseProjectConfig("secondary");
  const secretKey = process.env.SUPABASE_SECONDARY_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "Set SUPABASE_SECONDARY_SECRET_KEY in apps/web/.env.local to enable admin edits in the secondary project.",
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function createSupabasePrimaryServiceClient() {
  const { url } = getSupabaseProjectConfig("primary");
  const secretKey = process.env.SUPABASE_PRIMARY_SECRET_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    throw new Error(
      "Set a server-only Supabase secret key in apps/web/.env.local to enable artwork view tracking.",
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function isArtworkViewTrackingConfigured() {
  return Boolean(
    process.env.SUPABASE_PRIMARY_SECRET_KEY
      || process.env.SUPABASE_SECRET_KEY
      || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
