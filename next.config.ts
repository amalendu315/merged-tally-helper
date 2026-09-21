import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/tally",
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/.well-known/appspecific/com.chrome.devtools.json",
        destination: "/api/devtools-placeholder", // custom API route
      },
    ];
  },
};

export default nextConfig;
