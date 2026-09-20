import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";
const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/opengraph-image",
        destination: "/opengraph-image.jpg",
      },
    ];
  },
};
export default config;
