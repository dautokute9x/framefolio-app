import Link from "next/link";
import type { ReactNode } from "react";
import { Home, Images, LogOut, Plus, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signOutAction } from "@/lib/server-actions/auth";
import type { Profile } from "@/lib/types";

export function DashboardShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[280px_minmax(0,1fr)] md:px-6 lg:px-8">
        <aside className="surface h-fit p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Photographer</p>
            <h1 className="mt-2 font-display text-3xl">{profile.full_name ?? "Admin"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
          </div>

          <Separator className="my-5" />

          <nav className="space-y-2">
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/dashboard"><Home className="mr-2 h-4 w-4" />Overview</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/dashboard/albums/new"><Plus className="mr-2 h-4 w-4" />New album</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/portfolio"><Images className="mr-2 h-4 w-4" />Public portfolio</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/dashboard"><UploadCloud className="mr-2 h-4 w-4" />Upload manager</Link>
            </Button>
          </nav>

          <form action={signOutAction} className="mt-8">
            <Button type="submit" variant="outline" className="w-full justify-start">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </form>
        </aside>

        <div>{children}</div>
      </div>
    </div>
  );
}
