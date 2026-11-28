import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  // Dev validation of instant navigation drops the admin page and holds the
  // login request open, so the phone stays on "Проверяем…".
  experimental: {
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  // The phone opens the dev server by its hotspot address. Without this,
  // Next blocks the page scripts and only plain links keep working.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "order.broetli.com"],
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
