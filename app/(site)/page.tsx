import Link from "next/link";
import { ArrowRight, ImageIcon, LockKeyhole, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortfolioCard } from "@/components/marketing/portfolio-card";
import { getPublicPortfolioAlbums } from "@/lib/data";

export default async function HomePage() {
  const albums = await getPublicPortfolioAlbums(3);

  return (
    <div>
      <section className="subtle-grid border-b border-border/80">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Single photographer workflow</p>
            <h1 className="mt-5 font-display text-5xl leading-tight sm:text-6xl">
              Elegant client galleries with a calm, premium admin workflow.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Publish your portfolio, send private galleries, collect client selections,
              and review final favorites from one refined dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/portfolio">
                  View portfolio
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Admin login</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                icon: UploadCloud,
                title: "Direct uploads",
                body: "Send images straight to secure Supabase Storage from the browser.",
              },
              {
                icon: LockKeyhole,
                title: "Private access",
                body: "Use private share links and optional gallery passwords.",
              },
              {
                icon: ImageIcon,
                title: "Client selections",
                body: "Let clients shortlist their favorites on mobile, then review everything in admin.",
              },
            ].map((item) => (
              <div key={item.title} className="surface p-6">
                <item.icon className="h-6 w-6" />
                <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Featured work</p>
            <h2 className="mt-2 font-display text-4xl">Public portfolio</h2>
          </div>
          <Link href="/portfolio" className="text-sm font-medium text-primary">
            See all albums
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {albums.map((album) => (
            <PortfolioCard key={album.id} album={album} />
          ))}
        </div>
      </section>
    </div>
  );
}
