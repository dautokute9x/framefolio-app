import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Always run on request: this endpoint exists to touch the database.
export const dynamic = "force-dynamic";

/**
 * Lightweight health check. It runs one tiny database query, so calling it a
 * few times a week (see .github/workflows/keep-alive.yml) also keeps a
 * Supabase Free project from being paused after 7 days without activity.
 */
export async function GET() {
  const startedAt = Date.now();
  const { error } = await createAdminClient().from("albums").select("id", { head: true, count: "exact" }).limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
  return NextResponse.json(
    { ok: true, ms: Date.now() - startedAt },
    { headers: { "Cache-Control": "no-store" } }
  );
}
