import "server-only";

const required = (name: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
    );
  },
  get albumCookieSecret() {
    return required("ALBUM_COOKIE_SECRET", process.env.ALBUM_COOKIE_SECRET);
  },
  get allowSignup() {
    return process.env.ALLOW_SIGNUP === "true";
  },
};
