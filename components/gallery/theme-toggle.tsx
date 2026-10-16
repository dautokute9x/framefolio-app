"use client";

import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { GALLERY_THEME_COOKIE, type GalleryTheme } from "@/lib/gallery-theme";
import { cn } from "@/lib/utils";

/** Light/dark switch for client galleries; applied instantly, remembered in a cookie. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("gallery");
  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const scope = event.currentTarget.closest<HTMLElement>("[data-theme-scope]");
    const next: GalleryTheme = scope?.classList.contains("dark") ? "light" : "dark";
    scope?.classList.toggle("dark", next === "dark");
    document.cookie = `${GALLERY_THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-secondary",
        className
      )}
    >
      {/* Icons follow the scope's class, so they are right before hydration too. */}
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
