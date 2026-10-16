import "server-only";
import { headers } from "next/headers";

/**
 * Turns NEXT_PUBLIC_SITE_URL into a usable origin. Accepts values without a
 * scheme ("my-site.vercel.app") or with a trailing slash/path; returns null
 * when the value is missing or not a valid URL.
 *
 * Before this, a value without "https://" produced links such as
 * "/my-site.vercel.app/gallery/..." that the browser resolved relative to the
 * current page, so "Open gallery" led to a 404.
 */
export function normalizeSiteUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Origin of the current request, e.g. https://my-site.vercel.app. */
export async function getRequestOrigin(): Promise<string | null> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host");
  if (!host) return null;
  const proto =
    store.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

/**
 * Origin used for links sent to clients: NEXT_PUBLIC_SITE_URL when it is a
 * valid URL, otherwise the address the photographer is using right now.
 */
export async function getSiteOrigin() {
  const configured = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const current = await getRequestOrigin();
  return {
    origin: configured ?? current ?? "http://localhost:3000",
    configured,
    current,
    /** True when the configured site URL points somewhere other than this site. */
    mismatch:
      !!configured &&
      !!current &&
      new URL(configured).host !== new URL(current).host,
  };
}
