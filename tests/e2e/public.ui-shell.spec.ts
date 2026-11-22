import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicPages = [
  {
    path: "/",
    tab: "Home",
    inactiveTab: "Discover",
    hero: "Noggin: raise a genius by teaching it",
    callsToAction: ["Hatch a Nog", /^See how Noggin works(?:\s*↓)?$/],
  },
  {
    path: "/discover",
    tab: "Discover",
    inactiveTab: "Home",
    hero: /^Hello, your Nog is waiting$/i,
    callsToAction: ["Hatch a Nog", "Get Started"],
  },
] as const;

test("the landing hero offers sign-up and discovery", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    publicPages[0].hero,
  );
  await expect(main.getByRole("img", {
    name: "Three Nogs waving: a round baby Nog and two sprouting Nogs",
  })).toBeVisible();
  await expect(main.getByRole("link", { name: "Hatch a Nog", exact: true }))
    .toHaveAttribute("href", "/signup");
  await expect(main.getByRole("link", { name: publicPages[0].callsToAction[1] }))
    .toHaveAttribute("href", "/discover");
});

test("Discover presents the hero, six features and sign-up links", async ({ page }) => {
  await page.goto("/discover");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    publicPages[1].hero,
  );
  for (const name of [
    "A sprouting Nog flying with a book",
    "A Nog thinking",
    "A Nog peeking out of its eggshell",
  ]) {
    await expect(main.getByRole("img", { name, exact: true })).toBeVisible();
  }

  await expect(main.getByRole("heading", {
    level: 2,
    name: "Big things hatch at Noggin",
    exact: true,
  })).toBeVisible();
  const features = main.getByRole("list", { name: "What you can do", exact: true });
  await expect(features.getByRole("listitem")).toHaveCount(6);
  for (const label of [
    "Make it Yours",
    "Hatch a Nog",
    "Watch It Grow",
    "Challenge Friends",
    "Teach a Lesson",
    "Climb the Ranks",
  ]) {
    await expect(features.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(features.getByRole("link")).toHaveCount(0);

  for (const name of publicPages[1].callsToAction) {
    await expect(main.getByRole("link", { name, exact: true }))
      .toHaveAttribute("href", "/signup");
  }
  await expect(page.getByRole("contentinfo")).toContainText("@Noggin");
});

for (const { path, tab, inactiveTab, hero, callsToAction } of publicPages) {
  test(`${tab} marks its current tab and exposes the public navigation links`, async ({ page }) => {
    await page.goto(path);
    const header = page.getByRole("banner");
    const nav = header.getByRole("navigation", { name: "Main" });

    await expect(nav.getByRole("link", { name: tab, exact: true }))
      .toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: inactiveTab, exact: true }))
      .not.toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Home", exact: true }))
      .toHaveAttribute("href", "/");
    await expect(nav.getByRole("link", { name: "Discover", exact: true }))
      .toHaveAttribute("href", "/discover");
    await expect(header.getByRole("link", { name: "Log in", exact: true }))
      .toHaveAttribute("href", "/login");
  });

  test(`${tab} fits a 375 px viewport and keeps public links usable by touch`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: hero })).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const width = await page.evaluate(() => document.scrollingElement!.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);

    for (const name of ["Noggin home", "Home", "Discover", "Log in", ...callsToAction]) {
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      const bounds = await link.boundingBox();
      expect(bounds?.width, `Width of ${name}`).toBeGreaterThanOrEqual(44);
      expect(bounds?.height, `Height of ${name}`).toBeGreaterThanOrEqual(44);
    }
  });

  test(`${tab} follows the documented keyboard focus order`, async ({ page }) => {
    await page.goto(path);
    const logo = page.getByRole("link", { name: "Noggin home", exact: true });
    await expect(logo).toBeVisible();
    await logo.focus();
    await expect(logo).toBeFocused();

    for (const name of ["Home", "Discover", "Log in", ...callsToAction]) {
      await page.keyboard.press("Tab");
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toBeFocused();
      await expect(link).toHaveCSS("outline-style", "solid");
      await expect(link).toHaveCSS("outline-width", "3px");
    }
  });

  test(`${tab} has no serious or critical axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: hero })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).analyze();
    const seriousViolations = violations
      .filter(({ impact }) => impact === "serious" || impact === "critical")
      .map(({ id, impact, help, nodes }) => ({
        id,
        impact,
        help,
        targets: nodes.map(({ target }) => target),
      }));

    expect(seriousViolations).toEqual([]);
  });
}

test.describe("public navigation without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("Home and Discover are connected by ordinary links", async ({ page }) => {
    await page.goto("/");
    const discover = page.getByRole("link", { name: publicPages[0].callsToAction[1] });
    await expect(discover).toBeVisible();
    await discover.click();
    await expect(page).toHaveURL("/discover");
    await expect(page.getByRole("heading", { level: 1, name: publicPages[1].hero }))
      .toBeVisible();

    await page.getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Home", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: publicPages[0].hero }))
      .toBeVisible();
  });
});
