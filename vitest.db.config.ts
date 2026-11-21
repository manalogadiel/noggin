import { defineConfig } from "vitest/config";
import base, { DB_TESTS } from "./vitest.config";

// Tests that need the local Supabase stack (`npx supabase start`): run with `npm run test:db`.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: DB_TESTS,
    exclude: ["node_modules/**", ".next/**"],
  },
});
