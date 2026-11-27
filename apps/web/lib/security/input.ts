const INTERNAL_ORIGIN = "https://studio.invalid";

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  const parsed = new URL(value, INTERNAL_ORIGIN);
  if (parsed.origin !== INTERNAL_ORIGIN) return fallback;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
