"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
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
        setError(payload.error ?? "Mật khẩu chưa đúng");
        setLoading(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardContent className="p-8">
          <form onSubmit={submit} className="space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Lock className="h-6 w-6" />
            </div>

            <div className="text-center">
              <h1 className="font-display text-3xl">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Album được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu nhiếp ảnh gia đã gửi cho bạn.
              </p>
            </div>

            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Mật khẩu album"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Tiếp tục
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
