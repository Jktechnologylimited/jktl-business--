import type { NextConfig } from "next";

const localFrames = (process.env.GAME_LOCAL_FRAME_ORIGINS || "")
  .split(",")
  .filter((v) =>
    /^http:\/\/(?:[a-z-]+\.)?(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/.test(v),
  );
const nextConfig: NextConfig = {
  async headers() {
    return [
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
