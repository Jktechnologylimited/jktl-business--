import type { NextConfig } from "next";

const localFrames = (process.env.GAME_LOCAL_FRAME_ORIGINS || "")
  .split(",")
  .filter((v) =>
    /^http:\/\/(?:[a-z-]+\.)?(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/.test(v),
  );
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      ...["/business/:path*", "/admin/:path*", "/affiliates/:path*", "/partners/:path*", "/login", "/signup", "/forgot-password", "/reset-password"].map(source => ({
        source,
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      })),
      {
        source: "/play/tycoon",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' https://jktl.com.ng https://www.jktl.com.ng https://games.jktl.com.ng https://fantasy.jktl.com.ng ${localFrames.join(" ")}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
