// Public (browser-safe) environment values.
//
// IMPORTANT: Next.js only inlines `process.env.NEXT_PUBLIC_*` into the browser
// bundle when each variable is referenced *literally*. A dynamic lookup such as
// `process.env[name]` is always `undefined` in the browser, which previously
// crashed every client component that imported this file (e.g. the upload page).
// Server-only secrets live in `lib/env.server.ts`.

function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
};
