import type { NextConfig } from "next";

// Allow images from whatever Supabase host is configured (custom domain,
// self-hosted or *.supabase.co) instead of hard-coding one pattern.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      ...(supabaseHost ? [{ hostname: supabaseHost }] : []),
    ],
  },
  async headers() {
    return [
      {
        // Private client galleries must not be indexed or cached by shared proxies.
        source: "/gallery/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
