import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/** Need the local Supabase stack; `npm run test:db` runs them (vitest.db.config.ts). */
export const DB_TESTS = [
  "tests/db/**/*.test.{ts,tsx}",
  "src/adapters/supabase/__tests__/**/*.test.{ts,tsx}",
  "tests/auth/actions.auth-session.test.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**", ...DB_TESTS],
  },
});
