import { PortfolioCard } from "@/components/marketing/portfolio-card";
import { getPublicPortfolioAlbums } from "@/lib/data";

export default async function PortfolioPage() {
  const albums = await getPublicPortfolioAlbums(24);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Portfolio</p>
        <h1 className="mt-3 font-display text-5xl">A refined collection of public stories.</h1>
        <p className="mt-4 text-muted-foreground">
          This page only surfaces public albums. Private client work remains secured behind share links and optional passwords.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {albums.map((album) => (
          <PortfolioCard key={album.id} album={album} />
        ))}
      </div>
    </div>
  );
}
