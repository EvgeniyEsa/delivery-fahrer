import { networkInterfaces } from "node:os"

import type { NextConfig } from "next";

function lanOrigins() {
  const origins = new Set<string>()
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.internal || entry.family !== "IPv4") continue
      origins.add(entry.address)
    }
  }
  return [...origins]
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: lanOrigins(),
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
    ]
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
