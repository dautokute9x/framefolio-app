import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Refreshes the photographer's Supabase session cookie.
// Only routes that need a signed-in photographer run it: client galleries and
// their APIs are anonymous, so they skip the extra round trip to Supabase Auth.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/", "/portfolio", "/login", "/dashboard/:path*", "/auth/:path*", "/api/albums/:path*"],
};
