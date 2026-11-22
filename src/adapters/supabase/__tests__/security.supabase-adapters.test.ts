import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { preProcessFile } from "typescript";
import { expect, it } from "vitest";
import {
  createCard, createLesson, eq, exactlyOne, expectDenied, success, type Row,
} from "../../../../tests/db/helpers";
import {
  followUpArgs, followUpInput, leases, ownerFixture, repositoriesFor, reservationArgs, seededQuestions,
} from "./fixtures";

it("hides another user's Nog, lessons, cards, messages and attempts from a session repository", async () => {
  const { db, subject, topic, owner, nog } = await ownerFixture();
  const lesson = await createLesson(db, nog.id, topic.id);
  await createCard(db, nog.id, topic.id, lesson.id);
  const message = exactlyOne(await db.admin.rows<Row>("nog_messages", { select: "id" }, "POST", {
    nog_id: nog.id, lesson_id: lesson.id, role: "nog", kind: "reply", body: "SYN starts the handshake.",
  }), "Create owned message");
  const [question] = await seededQuestions(db, topic.id);
  const attempt = exactlyOne(await db.admin.rows<Row>("check_attempts", { select: "id" }, "POST", {
    nog_id: nog.id, question_id: question.id, nog_answer: "SYN comes first.",
    concepts: [], correct: true, notebook_fingerprint: randomUUID(),
  }), "Create owned check attempt");
  const stranger = await db.createUser();
  const { nogs, notebook, thoughtCards, attempts } = await repositoriesFor(stranger);

  expect(await nogs.findOwned(stranger.id, nog.id)).toBeNull();
  expect(await nogs.findOwned(owner.id, nog.id)).toBeNull();
  expect(await nogs.listByOwner(owner.id)).toEqual([]);
  expect(await nogs.findByOwnerAndSubject(owner.id, subject.id)).toBeNull();
  expect(await notebook.findPage(nog.id, lesson.id)).toBeNull();
  expect(await notebook.findPageByIdempotencyKey(nog.id, lesson.idempotency_key)).toBeNull();
  expect(await notebook.listPages(nog.id, topic.id)).toEqual([]);
  expect(await notebook.findOwnedMessage(stranger.id, message.id)).toBeNull();
  expect(await thoughtCards.listByTopic(nog.id, topic.id)).toEqual([]);
  expect(await thoughtCards.listByNog(nog.id)).toEqual([]);
  expect(await attempts.findLatest(nog.id, topic.id)).toEqual([]);
  expect(await attempts.listByNog(nog.id)).toEqual([]);
  expect(await attempts.findOwned(stranger.id, attempt.id)).toBeNull();
});

it("scopes privileged petting updates to the session owner", async () => {
  const { db, nog } = await ownerFixture();
  const stranger = await db.createUser();
  const { nogs } = await repositoriesFor(stranger);
  const fields = { id: eq(nog.id), select: "happiness,happiness_today,happiness_day" };
  const before = exactlyOne(await db.admin.rows("nogs", fields), "Read target Nog before petting");
  await expect(nogs.updatePetting({
    nogId: nog.id, happiness: 90, happinessToday: 5, happinessDay: "2026-11-21",
  })).rejects.toThrow();
  expect(exactlyOne(await db.admin.rows("nogs", fields), "Read target Nog after rejected petting")).toEqual(before);
});

it.each(["save_follow_up_page", "acquire_check_reservation", "release_check_reservation"] as const)(
  "denies anon and authenticated execution of %s",
  async (rpc) => {
    const { db, owner, nog, topic } = await ownerFixture();
    const lesson = await createLesson(db, nog.id, topic.id);
    const session = await db.signIn(owner);
    const holder = randomUUID();
    const args = {
      save_follow_up_page: followUpArgs(followUpInput({ id: lesson.id, nogId: nog.id, topicId: topic.id })),
      acquire_check_reservation: reservationArgs(nog.id, holder),
      release_check_reservation: { p_nog_id: nog.id, p_holder: holder },
    };
    const [anon, authenticated] = await Promise.all([
      db.anon.rpc(rpc, args[rpc]), session.rpc(rpc, args[rpc]),
    ]);
    expectDenied(anon, `Anon calls ${rpc}`);
    expectDenied(authenticated, `Authenticated calls ${rpc}`);
  },
);

it("keeps a lease when release is called with another holder", async () => {
  const { db, nog } = await ownerFixture();
  const holder = randomUUID();
  expect(success(await db.admin.rpc<boolean>("acquire_check_reservation", reservationArgs(nog.id, holder)),
    "Acquire reservation as its holder")).toBe(true);
  const active = await leases(db, nog.id);
  expect(active).toHaveLength(1);
  expect(active[0].holder).toBe(holder);

  const otherHolder = randomUUID();
  success(await db.admin.rpc("release_check_reservation", { p_nog_id: nog.id, p_holder: otherHolder }),
    "Request release with another holder");
  expect(await leases(db, nog.id)).toEqual(active);
  expect(success(await db.admin.rpc<boolean>("acquire_check_reservation", reservationArgs(nog.id, otherHolder)),
    "Try acquiring the still-active reservation")).toBe(false);

  success(await db.admin.rpc("release_check_reservation", { p_nog_id: nog.id, p_holder: holder }),
    "Release with the original holder");
  expect(await leases(db, nog.id)).toEqual([]);
});

it("marks the service client server-only and rejects its import in a Next client component build", async () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const service = fileURLToPath(new URL("../service-client.ts", import.meta.url));
  expect(existsSync(service), "src/adapters/supabase/service-client.ts is required").toBe(true);
  const imports = preProcessFile(await readFile(service, "utf8")).importedFiles.map(({ fileName }) => fileName);
  expect(imports).toContain("server-only");

  const project = await mkdtemp(fileURLToPath(new URL(".client-probe-", import.meta.url)));
  try {
    const app = join(project, "app");
    await mkdir(app);
    const serviceImport = relative(app, service).split(sep).join("/");
    await Promise.all([
      writeFile(join(project, "package.json"), JSON.stringify({ name: "noggin-client-probe", private: true })),
      writeFile(join(project, "next.config.mjs"), `export default ${JSON.stringify({
        outputFileTracingRoot: root, turbopack: { root },
      })};\n`),
      writeFile(join(app, "layout.js"), "export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n"),
      writeFile(join(app, "page.js"), [
        '"use client";',
        `import * as service from ${JSON.stringify(serviceImport)};`,
        "export default function Page() { return <p>{Object.keys(service).length}</p>; }",
      ].join("\n")),
    ]);

    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/(?:supabase|anon_key|publishable_key|secret_key|service_role_key|api_url)/i.test(key)));
    const run = promisify(execFile);
    const result = await run(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"),
      "build", project, "--turbopack"], {
      cwd: project, timeout: 75_000, env: { ...env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
    }).then(
      () => ({ rejectedClientImport: false, exitCode: 0 }),
      (error: { stdout?: string; stderr?: string; code?: number | string }) => {
        const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
        return {
          rejectedClientImport: /['"]server-only['"] cannot be imported from a Client Component/i.test(output),
          exitCode: error.code,
        };
      },
    );
    expect(result, "Next must reject the service-client import at the client boundary").toEqual({
      rejectedClientImport: true, exitCode: 1,
    });
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}, 90_000);
