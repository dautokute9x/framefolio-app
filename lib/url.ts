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
