import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const src = fileURLToPath(new URL("../../src/", import.meta.url));
const tokens = "styles/tokens.css";
const sourceExtensions = new Set([
  ".cjs", ".css", ".cts", ".html", ".js", ".jsx", ".json", ".mjs", ".mts",
  ".svg", ".ts", ".tsx",
]);
const hexColor = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w-])/i;

it("keeps hex colors in src/styles/tokens.css and uses that palette in the global theme", () => {
  const violations: string[] = [];

  for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) continue;

    const file = resolve(entry.parentPath, entry.name);
    const path = relative(src, file).split(sep).join("/");
    if (path === tokens) continue;

    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, index) => {
      if (hexColor.test(line)) {
        violations.push(`src/${path}:${index + 1}: ${line}`);
      }
    });
  }

  expect.soft(violations, "Hex colors outside src/styles/tokens.css").toEqual([]);
  const globals = readFileSync(resolve(src, "app/globals.css"), "utf8");
  const aliases = {
    background: "cream",
    foreground: "forest",
    primary: "leaf-strong",
    "primary-foreground": "white",
    ring: "leaf",
    "muted-foreground": "ink",
  };
  const missingAliases = Object.entries(aliases)
    .filter(([name, token]) =>
      !new RegExp(`^[ \\t]*--${name}:\\s*var\\(--noggin-${token}\\)\\s*;`, "m").test(globals),
    )
    .map(([name, token]) => `--${name}: var(--noggin-${token});`);
  expect(missingAliases, "Missing palette mappings in src/app/globals.css").toEqual([]);
});
