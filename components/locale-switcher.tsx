"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_COOKIE, LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const pending = switchingTo !== null;

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex h-10 items-center rounded-full border p-1 text-xs font-semibold",
        tone === "dark" ? "border-white/20 bg-white/5" : "border-border bg-card",
        pending && "opacity-60",
        className
      )}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={locale === code}
          disabled={pending}
          onClick={() => {
            if (code === locale) return;
            // Save the choice and reload: a soft router.refresh() occasionally never
            // committed after a locale change, leaving the page half-translated.
            document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
            setSwitchingTo(code);
            window.location.reload();
          }}
          className={cn(
            "h-8 min-w-10 rounded-full px-2.5 uppercase tracking-wide transition",
            locale === code
              ? tone === "dark"
                ? "bg-white text-black"
                : "bg-primary text-primary-foreground"
              : tone === "dark"
                ? "text-white/70 hover:text-white"
                : "text-muted-foreground hover:text-foreground"
          )}
        >
          {switchingTo === code ? <Loader2 aria-hidden className="mx-auto h-3.5 w-3.5 animate-spin" /> : null}
          <span className={switchingTo === code ? "sr-only" : undefined}>{code}</span>
        </button>
      ))}
    </div>
  );
}
