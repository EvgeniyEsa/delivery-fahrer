import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The phone opens the dev server by its hotspot address. Without this,
  // Next blocks the page scripts and only plain links keep working.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
