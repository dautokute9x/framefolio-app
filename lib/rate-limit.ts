import "server-only";
import crypto from "crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

let warned = false;

/**
 * Counts one request against `key` and says whether it is allowed. Backed by
 * the rate_limit_hit() function (migration 0004), so the limit holds across
 * all serverless instances. Fails open if the database cannot answer.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    if (!warned) console.warn("[rate-limit] disabled:", error.message);
    warned = true;
    return true;
  }
  return data !== false;
}

/** A keyed hash of the visitor's IP: good for rate limiting, never stored as the IP itself. */
export async function visitorKey() {
  const store = await headers();
  const ip = store.get("x-real-ip") ?? store.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return crypto
    .createHmac("sha256", process.env.ALBUM_COOKIE_SECRET ?? "framefolio")
    .update(ip)
    .digest("base64url")
    .slice(0, 22);
}
