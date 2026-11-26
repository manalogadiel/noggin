// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RestView } from "@/components/care/rest-view";

vi.mock("@/components/nog-3d/nog-stage", () => ({
  NogStage: ({ scene, alt }: { scene: string; alt?: string }) => <div data-testid="nog-stage" data-scene={scene} aria-label={alt} />,
}));

afterEach(cleanup);

const now = new Date("2026-11-22T08:00:00.000Z");
const nog = { id: "nog-1", name: "Pingu" };

describe("Rest (Figma Nap 257:347 / 259:185)", () => {
  it("shows Take a Rest! with 4 duration radio tiles defaulting to 2 days and no bordered dropdown", async () => {
    const onStartRest = vi.fn();
    render(<RestView nog={nog} restUntil={null} now={now} onStartRest={onStartRest} onWake={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: /take a rest!/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    const group = screen.getByRole("radiogroup", { name: /rest duration/i });
    expect(group).toBeVisible();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByRole("radio", { name: /^1 Day/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: /^2 Days/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^3 Days/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: /^1 Week/i })).toBeVisible();
    expect(screen.getByTestId("nog-stage")).toHaveAttribute("data-scene", "sleeping");

    await userEvent.click(screen.getByRole("radio", { name: /^3 Days/i }));
    await userEvent.click(screen.getByRole("button", { name: /start resting/i }));
    expect(onStartRest).toHaveBeenCalledWith(3);
  });

  it("treats a past rest_until as not resting", () => {
    render(<RestView nog={nog} restUntil="2026-11-20T08:00:00.000Z" now={now} onStartRest={vi.fn()} onWake={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /take a rest!/i })).toBeInTheDocument();
  });

  it("shows Nog Resting with room, notebook and wake actions while resting", async () => {
    const onWake = vi.fn();
    render(<RestView nog={nog} restUntil="2026-11-24T08:00:00.000Z" now={now} onStartRest={vi.fn()} onWake={onWake} />);

    expect(screen.getByRole("heading", { level: 1, name: /nog resting/i })).toBeInTheDocument();
    expect(screen.getByText(/back on/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to nog room/i })).toHaveAttribute("href", "/nogs/nog-1");
    expect(screen.getByRole("link", { name: /view notebook/i })).toHaveAttribute("href", "/nogs/nog-1/notebook");
    await userEvent.click(screen.getByRole("button", { name: /wake nog/i }));
    expect(onWake).toHaveBeenCalled();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});
