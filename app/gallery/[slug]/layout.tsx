import { cookies } from "next/headers";
import { GALLERY_THEME_COOKIE, parseGalleryTheme } from "@/lib/gallery-theme";
import { cn } from "@/lib/utils";

/** Client-facing pages share the visitor's light/dark choice (cookie, so no flash on load). */
export default async function GalleryLayout({ children }: { children: React.ReactNode }) {
  const theme = parseGalleryTheme((await cookies()).get(GALLERY_THEME_COOKIE)?.value);
  return (
    <main
      id="main"
      data-theme-scope
      className={cn("min-h-screen bg-background text-foreground", theme === "dark" && "dark")}
    >
      {children}
    </main>
  );
}
