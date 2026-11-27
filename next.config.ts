import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Playwright opens the dev server on 127.0.0.1; dev-only, ignored by production builds.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  turbopack: {
    root: workspaceRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
