export const UNSUBSCRIBE_PLACEHOLDER = "{{UNSUBSCRIBE_URL}}";
export const UNSUBSCRIBE_PLACEHOLDER_RE = /\{\{UNSUBSCRIBE_URL\}\}/g;

export function normalizePublicUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

function isTrustedFallbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".vercel.app")
    );
  } catch {
    return false;
  }
}

function trustedFallbackOrigin(value: string | null): string {
  const origin = normalizePublicUrl(value);
  return origin && isTrustedFallbackOrigin(origin) ? origin : "";
}

export function resolveAppPublicUrl(
  req: Request,
  configuredUrl = Deno.env.get("APP_PUBLIC_URL"),
): string {
  const configured = normalizePublicUrl(configuredUrl);
  if (configured) return configured;

  const origin = trustedFallbackOrigin(req.headers.get("Origin"));
  if (origin) return origin;

  const referer = req.headers.get("Referer");
  if (!referer) return "";

  try {
    return trustedFallbackOrigin(new URL(referer).origin);
  } catch {
    return "";
  }
}
