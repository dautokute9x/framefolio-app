import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { PortfolioCard } from "@/components/marketing/portfolio-card";
import { Button } from "@/components/ui/button";
import { getBrand } from "@/lib/brand";
import { getPublicPortfolioAlbums } from "@/lib/data";

export default async function HomePage() {
  const [t, brand, albums] = await Promise.all([getTranslations("home"), getBrand(), getPublicPortfolioAlbums(6)]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-14 sm:py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">{brand.name}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t("tagline")}</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/portfolio">
            {t("viewPortfolio")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="pb-16">
        <h2 className="font-display text-2xl sm:text-3xl">{t("recentWork")}</h2>
        {albums.length ? (
          <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <PortfolioCard key={album.id} album={album} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {t("empty")}
          </p>
        )}
      </section>
    </div>
  );
}
