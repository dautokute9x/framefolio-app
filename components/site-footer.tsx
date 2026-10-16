import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getBrand } from "@/lib/brand";

export async function SiteFooter() {
  const [t, brand] = await Promise.all([getTranslations("site"), getBrand()]);
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p>© {new Date().getFullYear()} {brand.name}</p>
        <Link href="/login" className="hover:text-foreground">
          {t("photographerLogin")}
        </Link>
      </div>
    </footer>
  );
}
