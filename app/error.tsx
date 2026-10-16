"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">{t("errorTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("errorBody")}</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">#{error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        {t("retry")}
      </Button>
    </main>
  );
}
