import { getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/gallery/theme-toggle";

export async function AlbumExpired({ title }: { title: string }) {
  const t = await getTranslations("gallery");
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div className="flex items-center gap-2 self-end">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
      <div className="w-full rounded-2xl border border-border bg-card p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-display text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("expired")}</p>
      </div>
    </div>
  );
}
