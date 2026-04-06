 "use client";

import { useState } from "react";
import { Lock } from "lucide-react";
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
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/gallery/${slug}/unlock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, shareToken }),
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Invalid password");
      setLoading(false);
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardContent className="space-y-5 p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <Lock className="h-6 w-6" />
          </div>

          <div className="text-center">
            <h1 className="font-display text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This gallery is password protected. Enter the client password to continue.
            </p>
          </div>

          <Input
            type="password"
            placeholder="Gallery password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button className="w-full" disabled={loading} onClick={submit}>
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
