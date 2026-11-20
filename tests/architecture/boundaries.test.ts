import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);

function readScaffoldFile(path: string) {
  const file = new URL(path, root);
  expect(existsSync(file), `${path} is required by the scaffold`).toBe(true);
  return readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

describe("scaffold", () => {
  it("defines the lint, typecheck, test and build scripts", () => {
    const { scripts } = JSON.parse(readScaffoldFile("package.json"));

    for (const script of ["lint", "typecheck", "test", "build"]) {
      expect(scripts?.[script], `npm script: ${script}`).toMatch(/\S/);
    }
  });

  it.each([
    "@/adapters/supabase/server-client",
    "@/app/api/voice/speak/route",
    "next",
    "@supabase/supabase-js",
    "@supabase/ssr",
  ])("reports a lint error for a core import from %s", async (specifier) => {
    const config = new URL("eslint.config.mjs", root);
    expect(existsSync(config), "eslint.config.mjs is required by the scaffold").toBe(
      true,
    );

    const { ESLint } = await import("eslint");
    const eslint = new ESLint({ cwd: fileURLToPath(root) });
    const source = `import ${JSON.stringify(specifier)};\n`;
    const [core] = await eslint.lintText(source, {
      filePath: "src/core/domain/architecture-probe.ts",
    });
    const [adapter] = await eslint.lintText(source, {
      filePath: "src/adapters/architecture-probe.ts",
    });

    const adapterRules = new Set(adapter.messages.map(({ ruleId }) => ruleId));
    const boundaryErrors = core.messages.filter(
      ({ line, message, ruleId, severity }) =>
        line === 1 &&
        severity === 2 &&
        message.includes(specifier) &&
        ruleId &&
        !adapterRules.has(ruleId),
    );
    expect(
      boundaryErrors.length,
      `Expected a core-only lint error for ${specifier}`,
    ).toBeGreaterThan(0);
  });

  it("lists the required environment variables with empty values", () => {
    const example = readScaffoldFile(".env.example");

    for (const key of [
      "LLM_BASE_URL",
      "LLM_API_KEY",
      "LLM_MODEL",
      "LLM_FALLBACK_BASE_URL",
      "LLM_FALLBACK_MODEL",
      "STT_MODEL",
      "TTS_MODEL",
      "GEMINI_API_KEY",
      "GROQ_API_KEY",
      "WHISPER_CPP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      const assignments = [
        ...example.matchAll(new RegExp(`^[ \\t]*${key}[ \\t]*=([^\\r\\n]*)`, "gm")),
      ];
      expect(assignments.length, `${key} must appear once`).toBe(1);
      expect(
        /^[ \t]*(?:""|'')?[ \t]*(?:#.*)?$/.test(assignments[0][1]),
        `${key} must be empty`,
      ).toBe(true);
    }
  });

  it("runs the scaffold checks on pull requests to staging and main", () => {
    const workflow = readScaffoldFile(".github/workflows/ci.yml");
    const pullRequest =
      workflow.match(/^([ \t]+)pull_request:[^\r\n]*((?:\r?\n\1[ \t]+[^\r\n]*)*)/m)?.[2] ?? "";
    const branches = pullRequest.match(
      /^([ \t]+)branches:([^\r\n]*)((?:\r?\n\1[ \t]*-[^\r\n]*)*)/m,
    );
    const branchFilter = `${branches?.[2] ?? ""}${branches?.[3] ?? ""}`.replace(
      /#[^\r\n]*/g,
      "",
    );
    const branchNames = branchFilter.match(/[\w!*/.-]+/g) ?? [];

    for (const branch of ["staging", "main"]) {
      expect(branchNames).toContain(branch);
    }

    const runSteps = [
      ...workflow.matchAll(/^([ \t]*)(?:-[ \t]+)?run:([^\r\n]*)((?:\r?\n\1[ \t]+[^\r\n]*)*)/gm),
    ];
    const commands = runSteps.map(([, , inline, block]) => `${inline}${block}`).join("\n");

    for (const args of [/run\s+lint/, /run\s+typecheck/, /(?:run\s+)?test/, /run\s+build/]) {
      expect(commands).toMatch(new RegExp(`\\bnpm\\s+${args.source}(?=$|[\\s;|&"'])`));
    }
  });
});
