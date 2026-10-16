import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LayoutDashboard } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getBrand } from "@/lib/brand";

export async function SiteHeader() {
  const [t, profile, brand] = await Promise.all([getTranslations("site"), getCurrentProfile(), getBrand()]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="truncate font-display text-xl tracking-tight sm:text-2xl">
          {brand.name}
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/portfolio" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">
            {t("portfolio")}
          </Link>
          <LocaleSwitcher />
          {profile ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard" aria-label={t("dashboard")}>
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">{t("dashboard")}</span>
              </Link>
            </Button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
