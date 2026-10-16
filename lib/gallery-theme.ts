export const GALLERY_THEME_COOKIE = "ff_gallery_theme";
export type GalleryTheme = "light" | "dark";

export function parseGalleryTheme(value: string | undefined | null): GalleryTheme {
  return value === "dark" ? "dark" : "light";
}
