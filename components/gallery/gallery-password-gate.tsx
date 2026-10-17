"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/gallery/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function GalleryPasswordGate({
  slug,
  shareToken,
  title,
}: {
  slug: string;
  shareToken?: string | null;
  title: string;
}) {
  const t = useTranslations("gate");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A real <form> so pressing Enter / "Go" on the phone keyboard submits.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/gallery/${slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, shareToken }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? t("wrong"));
        setLoading(false);
        return;
      }

      window.location.reload();
    } catch {
      setError(t("network"));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10">
      <div className="flex items-center gap-2 self-end">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
      <Card className="w-full">
        <CardContent className="p-8">
          <form onSubmit={submit} className="space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Lock className="h-6 w-6" />
            </div>

            <div className="text-center">
              <h1 className="font-display text-3xl">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("body")}
              </p>
            </div>

            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" loading={loading} disabled={!password}>
              {t("continue")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
