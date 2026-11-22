// @vitest-environment jsdom
/// <reference types="vite/client" />

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ListNogsResult } from "@/core/application/use-cases/list-nogs";

const { getDisplayName, listNogs } = vi.hoisted(() => ({
  getDisplayName: vi.fn<() => Promise<string | null>>(),
  listNogs: vi.fn<() => Promise<ListNogsResult>>(),
}));

vi.mock("@/composition/container", () => ({
  createContainer: async () => ({ getDisplayName, listNogs }),
}));

const homeRoutes = import.meta.glob<{ default: () => ReactElement | Promise<ReactElement> }>(
  "../../src/app/*/home/{page,loading}.tsx",
);

async function renderHomeRoute(file: "page" | "loading") {
  const path = `../../src/app/(app)/home/${file}.tsx`;
  const load = homeRoutes[path];
  if (!load) throw new Error(`Missing Home route: ${path}`);
  const { default: Route } = await load();
  return render(await Route());
}

beforeEach(() => {
  getDisplayName.mockReset().mockResolvedValue(null);
  listNogs.mockReset().mockResolvedValue({ status: "ok", nogs: [] });
});

afterEach(cleanup);

it("greets the user by first name and shows at most three Nog cards", async () => {
  const previews = [
    { id: "pip", name: "Pip", stage: "hatchling" },
    { id: "lumi", name: "Lumi", stage: "sprout" },
    { id: "milo", name: "Milo", stage: "scholar" },
    { id: "sol", name: "Sol", stage: "genius" },
  ] as const;
  const nogs = previews.map((nog) => ({ ...nog, ownerId: "user-1", subjectId: nog.id }));
  getDisplayName.mockResolvedValue("Ada Lovelace");
  listNogs.mockResolvedValue({ status: "ok", nogs });

  await renderHomeRoute("page");

  expect(screen.getByRole("heading", { level: 1, name: "Hi, Ada!" })).toBeVisible();
  expect(screen.getByRole("heading", { level: 2, name: "Ready to teach Pip?" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Continue teaching" })).toHaveAttribute("href", "/nogs/pip");
  expect(screen.getByRole("heading", { level: 2, name: "Your Nogs" })).toBeVisible();
  expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/nogs");
  for (const [name, href, stage] of [
    ["Pip", "/nogs/pip", "Hatchling"],
    ["Lumi", "/nogs/lumi", "Sprout"],
    ["Milo", "/nogs/milo", "Scholar"],
  ]) {
    const card = screen.getByRole("link", { name: `${name}, ${stage}` });
    expect(card).toHaveAttribute("href", href);
    expect(within(card).getByText(stage, { exact: true })).toBeVisible();
  }
  expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).not.toContain("/nogs/sol");
});

it("greets an unnamed user and links the empty state to adoption", async () => {
  await renderHomeRoute("page");

  expect(screen.getByRole("heading", { level: 1, name: "Hi there!" })).toBeVisible();
  expect(screen.getByRole("heading", { level: 2, name: "No Nogs yet" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Hatch your first Nog" })).toHaveAttribute("href", "/adopt");
  expect(screen.queryByRole("heading", { name: "Your Nogs" })).not.toBeInTheDocument();
});

it("shows the brain-fog alert and a retry link when listing Nogs fails", async () => {
  listNogs.mockRejectedValue(new Error("Fixture repository failure"));

  await renderHomeRoute("page");

  expect(screen.getByRole("heading", { level: 2, name: "Brain fog 😵" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load your Nogs.");
  expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/home");
  expect(screen.queryByRole("link", { name: "Hatch your first Nog" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Your Nogs" })).not.toBeInTheDocument();
});

it("marks the Home loading state busy and keeps skeletons out of the tab order", async () => {
  const { container } = await renderHomeRoute("loading");

  expect(container.querySelector('[aria-busy="true"]')).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(container.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .not.toBeInTheDocument();
});
