import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PortfolioCard } from "@/components/marketing/portfolio-card";
import { getPublicPortfolioAlbums } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portfolio");
  return { title: t("title") };
}

export default async function PortfolioPage() {
  const [t, albums] = await Promise.all([getTranslations("portfolio"), getPublicPortfolioAlbums(48)]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">{t("intro")}</p>
      {albums.length ? (
        <div className="mt-10 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <PortfolioCard key={album.id} album={album} />
          ))}
        </div>
      ) : (
        <p className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}
