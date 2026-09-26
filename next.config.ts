import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Captcha tiles are read from disk by the tile route, never served from public/.
  outputFileTracingIncludes: { '/api/captcha/tile/[token]': ['./assets/captcha/**/*'] },
};

export default nextConfig;
