import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright opens the dev server on 127.0.0.1; dev-only, ignored by production builds.
  allowedDevOrigins: ["127.0.0.1"],
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
