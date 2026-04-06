import Link from "next/link";
import { Camera, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-wide">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Camera className="h-5 w-5" />
          </span>
          <span className="font-display text-xl">Framefolio</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="/">Home</Link>
          <Link href="/portfolio">Portfolio</Link>
          {profile ? <Link href="/dashboard">Dashboard</Link> : <Link href="/login">Login</Link>}
        </nav>

        {profile ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Admin Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
