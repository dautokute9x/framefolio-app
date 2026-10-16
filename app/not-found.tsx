import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-6xl">404</p>
      <h1 className="mt-4 text-xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}
