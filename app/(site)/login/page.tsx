import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { serverEnv } from "@/lib/env.server";
import { signInAction, signUpAction } from "@/lib/server-actions/auth";

const ERROR_KEYS = ["invalid", "noAccess", "signupDisabled", "signupFailed"] as const;
const NOTICE_KEYS = ["created", "signIn"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title"), robots: { index: false } };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("login");
  const params = (await searchParams) ?? {};
  const error = ERROR_KEYS.find((key) => key === params.error);
  const notice = NOTICE_KEYS.find((key) => key === params.notice);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Lock className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-center font-display text-3xl">{t("title")}</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">{t("subtitle")}</p>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      ) : notice ? (
        <p role="status" className="mt-6 rounded-xl bg-secondary px-3 py-2 text-sm">
          {t(`notices.${notice}`)}
        </p>
      ) : null}

      <form action={signInAction} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full">
          {t("submit")}
        </Button>
      </form>

      {serverEnv.allowSignup ? (
        <form action={signUpAction} className="mt-10 space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="font-semibold">{t("signupTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("signupHint")}</p>
          </div>
          <Input name="fullName" placeholder={t("fullName")} aria-label={t("fullName")} />
          <Input name="email" type="email" placeholder={t("email")} aria-label={t("email")} required />
          <Input name="password" type="password" placeholder={t("password")} aria-label={t("password")} autoComplete="new-password" required />
          <Button type="submit" variant="outline" className="w-full">
            {t("signupSubmit")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
