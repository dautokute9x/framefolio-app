import "server-only";

function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const serverEnv = {
  supabaseServiceRoleKey: required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  ),
  albumCookieSecret: required(
    "ALBUM_COOKIE_SECRET",
    process.env.ALBUM_COOKIE_SECRET
  ),
  /** Set to "true" only while creating the photographer account. */
  allowSignup: process.env.ALLOW_SIGNUP === "true",
};
