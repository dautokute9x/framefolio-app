import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/constants";
import { serverEnv } from "@/lib/env.server";
import { signInAction, signUpAction } from "@/lib/server-actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const message = typeof params.message === "string" ? params.message : "";

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="max-w-xl">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Secure admin area</p>
        <h1 className="mt-4 font-display text-5xl">Sign in to manage albums, uploads, and client selections.</h1>
        <p className="mt-4 text-muted-foreground">
          This starter is intentionally built for a single photographer, with a clean dashboard and a simple client-facing gallery flow.
        </p>

        <div className="surface mt-8 p-5 text-sm">
          <p className="font-medium">Demo account after seeding</p>
          <p className="mt-2 text-muted-foreground">Email: {DEMO_EMAIL}</p>
          <p className="text-muted-foreground">Password: {DEMO_PASSWORD}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="space-y-5 p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">Sign in</h2>
                <p className="text-sm text-muted-foreground">Use your photographer admin account.</p>
              </div>
            </div>

            {message ? <p className="rounded-xl bg-secondary px-3 py-2 text-sm">{message}</p> : null}

            <form action={signInAction} className="space-y-4">
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="password" type="password" placeholder="Password" required />
              <Button type="submit" className="w-full">Sign in</Button>
            </form>
          </CardContent>
        </Card>

        {serverEnv.allowSignup ? (
          <Card>
            <CardContent className="space-y-5 p-8">
              <div>
                <h2 className="text-xl font-semibold">Create photographer account</h2>
                <p className="text-sm text-muted-foreground">
                  The first authenticated user becomes usable immediately after the profile trigger runs.
                </p>
              </div>

              <form action={signUpAction} className="space-y-4">
                <Input name="fullName" placeholder="Full name" />
                <Input name="email" type="email" placeholder="Email" required />
                <Input name="password" type="password" placeholder="Password" required />
                <Button type="submit" variant="outline" className="w-full">Create account</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
