import type { SupabaseProject } from "@/features/landing/data/realms";

export type SupabaseProjectConfig = {
  url: string | undefined;
  publishableKey: string | undefined;
};

const projectConfigs: Record<SupabaseProject, SupabaseProjectConfig> = {
  primary: {
    url: process.env.NEXT_PUBLIC_SUPABASE_PRIMARY_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PRIMARY_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  secondary: {
    url: process.env.NEXT_PUBLIC_SUPABASE_SECONDARY_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_SECONDARY_PUBLISHABLE_KEY,
  },
};

export function isSupabaseProjectConfigured(project: SupabaseProject): boolean {
  const config = projectConfigs[project];
  const hasUrl = Boolean(config.url);
  const hasKey = Boolean(config.publishableKey);

  if (hasUrl !== hasKey) {
    getSupabaseProjectConfig(project);
  }

  return hasUrl && hasKey;
}

export function getSupabaseProjectConfig(
  project: SupabaseProject,
): { url: string; publishableKey: string } {
  const config = projectConfigs[project];
  const prefix = `NEXT_PUBLIC_SUPABASE_${project.toUpperCase()}`;

  if (!config.url) {
    throw new Error(`Set ${prefix}_URL in apps/web/.env.local.`);
  }

  if (!config.publishableKey) {
    throw new Error(`Set ${prefix}_PUBLISHABLE_KEY in apps/web/.env.local.`);
  }

  return { url: config.url, publishableKey: config.publishableKey };
}
