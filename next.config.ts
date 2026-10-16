import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are served as short-lived signed URLs of pre-sized previews, so the
  // Next.js image optimizer (/_next/image) is not used anywhere. Turning it off
  // removes an endpoint that has had several security advisories.
  images: {
    unoptimized: true,
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
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
