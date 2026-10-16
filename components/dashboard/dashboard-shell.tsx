import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { DashboardBottomNav, DashboardTopNav } from "@/components/dashboard/dashboard-nav";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/server-actions/auth";
import type { Profile } from "@/lib/types";

export async function DashboardShell({
  profile,
  inboxCount,
  children,
}: {
  profile: Profile;
  inboxCount: number;
  children: ReactNode;
}) {
  const t = await getTranslations("nav");
  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-[#f7f4ef]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="truncate font-display text-xl" title={profile.email}>
              {profile.full_name || t("studio")}
            </Link>
            <DashboardTopNav inboxCount={inboxCount} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LocaleSwitcher />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label={t("signOut")} title={t("signOut")}>
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-12">
        {children}
      </main>
      <DashboardBottomNav inboxCount={inboxCount} />
    </div>
  );
}
