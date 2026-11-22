import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import ts from "typescript";

const src = new URL("../../src/", import.meta.url);

it.each(["core/domain/ask.ts", "core/application/use-cases/ask-nog.ts"])(
  "keeps %s independent of adapters and framework packages",
  (path) => {
    const file = new URL(path, src);
    const { importedFiles } = ts.preProcessFile(readFileSync(file, "utf8"), true, true);
    const forbiddenImports = importedFiles
      .map(({ fileName }) => fileName)
      .filter((specifier) => {
        if (/^(?:@\/(?:adapters|app)|next|@supabase)(?:\/|$)/u.test(specifier)) {
          return true;
        }
        if (!specifier.startsWith(".")) return false;
        const imported = new URL(specifier, file).href;
        return ["adapters", "app"].some((layer) => {
          const layerUrl = new URL(layer, src).href;
          return imported === layerUrl || imported.startsWith(`${layerUrl}/`);
        });
      });

    expect(forbiddenImports).toEqual([]);
  },
);
