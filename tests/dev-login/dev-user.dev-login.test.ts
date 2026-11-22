import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { afterEach, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/dev-user.ts", import.meta.url));
const fixture = new URL("./dev-user-supabase.mjs", import.meta.url).href;
const linkedRef = "stagingproject000001";
const email = "dev@example.test";
const password = "fixture-dev-user-password";
const serviceKey = "fixture-service-role-key";
const anonKey = "fixture-anon-key";
let cwd: string | undefined;

function makeProject() {
  cwd = mkdtempSync(join(tmpdir(), "noggin-dev-user-"));
  const temp = join(cwd, "supabase", ".temp");
  mkdirSync(temp, { recursive: true });
  writeFileSync(join(temp, "project-ref"), `${linkedRef}\n`);
  return { cwd, state: join(cwd, "supabase-fixture.json") };
}

afterEach(() => {
  if (!cwd) return;
  rmSync(join(cwd, "supabase-fixture.json"), { force: true });
  rmSync(join(cwd, "supabase", ".temp", "project-ref"), { force: true });
  rmdirSync(join(cwd, "supabase", ".temp"));
  rmdirSync(join(cwd, "supabase"));
  rmdirSync(cwd);
  cwd = undefined;
});

function runDevUser(cwd: string, overrides: Record<string, string | undefined> = {}) {
  if (!existsSync(script)) throw new Error("Missing dev-user entry point: scripts/dev-user.ts");
  const result = spawnSync(process.execPath, ["--import", fixture, script], {
    cwd,
    encoding: "utf8",
    timeout: 5_000,
    env: {
      SystemRoot: process.env.SystemRoot,
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: `https://${linkedRef}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      DEV_LOGIN_EMAIL: email,
      DEV_LOGIN_PASSWORD: password,
      ...overrides,
    },
  });
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`.trim();
  for (const secret of [password, overrides.DEV_LOGIN_PASSWORD, anonKey, serviceKey]) {
    if (secret) expect(output).not.toContain(secret);
  }
  return { status: result.status, output };
}

it.each([
  { name: "production", env: { NODE_ENV: "production" } },
  { name: "Vercel", env: { VERCEL: "1" } },
  { name: "an unlinked project", env: { NEXT_PUBLIC_SUPABASE_URL: "https://otherproject00000001.supabase.co" } },
])("refuses provisioning on $name before connecting to Supabase", ({ env }) => {
  const project = makeProject();
  const result = runDevUser(project.cwd, env);

  expect(result.status).not.toBeNull();
  expect(result.status).not.toBe(0);
  expect(existsSync(project.state)).toBe(false);
});

it.each([
  { name: "the linked project", url: `https://${linkedRef}.supabase.co` },
  { name: "local Supabase", url: "http://127.0.0.1:54321" },
])("creates and updates one confirmed adult Plus user on $name", ({ url }) => {
  const project = makeProject();
  const first = runDevUser(project.cwd, { NEXT_PUBLIC_SUPABASE_URL: url });

  expect(first.status, first.output).toBe(0);
  expect(first.output).toContain(email);
  expect(first.output).toMatch(/\bready\b/i);
  const initial = JSON.parse(readFileSync(project.state, "utf8"));
  expect(initial.users).toEqual([
    expect.objectContaining({
      id: "fixture-user",
      email,
      password,
      email_confirm: true,
      user_metadata: expect.objectContaining({
        birth_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        display_name: "Dev Tester",
      }),
    }),
  ]);
  const adultBirthDate = new Date();
  adultBirthDate.setUTCFullYear(adultBirthDate.getUTCFullYear() - 18);
  expect(Date.parse(initial.users[0].user_metadata.birth_date)).toBeLessThanOrEqual(+adultBirthDate);
  expect(initial.profiles["fixture-user"]).toMatchObject({
    plan_code: "plus",
    guardian_consent_status: "not_required",
    birth_date: initial.users[0].user_metadata.birth_date,
  });

  const newPassword = "fixture-rotated-password";
  const second = runDevUser(project.cwd, {
    NEXT_PUBLIC_SUPABASE_URL: url,
    DEV_LOGIN_PASSWORD: newPassword,
  });

  expect(second.status, second.output).toBe(0);
  const updated = JSON.parse(readFileSync(project.state, "utf8"));
  expect(updated.users).toEqual([{ ...initial.users[0], password: newPassword }]);
  expect(updated.profiles).toEqual(initial.profiles);
});

it("registers the dev:user script in package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  expect(pkg.scripts).toHaveProperty("dev:user", expect.stringMatching(/\bscripts\/dev-user\.ts\b/));
});

it("lists the new environment keys with empty values in the template", () => {
  const template = parseEnv(readFileSync(new URL("../../.env.example", import.meta.url), "utf8"));
  for (const key of ["DEV_AUTO_LOGIN", "DEV_LOGIN_EMAIL", "DEV_LOGIN_PASSWORD", "LLM_ASKER_MODEL"]) {
    expect(template[key] === "", `Expected an empty template value for ${key}`).toBe(true);
  }
});
