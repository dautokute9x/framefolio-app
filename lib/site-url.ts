import "server-only";
import { headers } from "next/headers";
import { normalizeSiteUrl } from "@/lib/url";

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
