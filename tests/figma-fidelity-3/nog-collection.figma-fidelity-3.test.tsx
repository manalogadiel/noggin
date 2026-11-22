// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NogCollection } from "@/components/nog/nog-collection";

const nogs = [
  { id: "nog-1", name: "Pingu", subjectName: "Networking", stage: "sprout" as const },
  { id: "nog-2", name: "Mochi", subjectName: "Biology", stage: "hatchling" as const },
];

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* storage unavailable */
  }
});
afterEach(cleanup);

describe("My Nogs (Figma My Nogs 3 255:253)", () => {
  it("shows a grid by default with Lvl. per Nog and a Hatch New card", () => {
    render(<NogCollection nogs={nogs} />);
    const view = screen.getByRole("radiogroup", { name: /view/i });
    expect(within(view).getByRole("radio", { name: /grid view/i })).toBeChecked();
    expect(screen.getByRole("link", { name: /pingu/i })).toHaveAttribute("href", "/nogs/nog-1");
    expect(screen.getByText("Lvl. 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /hatch new/i })).toHaveAttribute("href", "/adopt");
  });

  it("switches to a list of rows and remembers the choice", async () => {
    const { unmount } = render(<NogCollection nogs={nogs} />);
    await userEvent.click(screen.getByRole("radio", { name: /list view/i }));
    const list = screen.getByRole("list", { name: /nogs/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByRole("link", { name: /mochi/i })).toHaveAttribute("href", "/nogs/nog-2");
    unmount();

    render(<NogCollection nogs={nogs} />);
    expect(screen.getByRole("radio", { name: /list view/i })).toBeChecked();
  });
});
