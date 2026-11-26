import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { test } from "./support/session";

test("Home redirects a signed-out request to login with its return path", async ({ request }) => {
  const response = await request.get("/home", { maxRedirects: 0 });

  expect([301, 302, 303, 307, 308]).toContain(response.status());
  expect(new URL(response.headers().location, response.url()).href)
    .toBe(new URL("/login?next=%2Fhome", response.url()).href);
});

const viewports = [
  { label: "phone", width: 375, height: 812, mobile: true },
  { label: "desktop", width: 1440, height: 900, mobile: false },
] as const;

for (const { label, width, height, mobile } of viewports) {
  test(`Home shows the ${label} topbar and app navigation drawer destinations`, async ({ page, signedInUser }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/home");

    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: `Hi, ${signedInUser.displayName.split(" ")[0]}!` }),
    ).toBeVisible();

    const menuButton = page.getByRole("button", { name: "Open menu", exact: true });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("link", { name: "Switch Nog", exact: true })).toHaveAttribute(
      "href",
      "/nogs",
    );
    await expect(
      page.getByRole("link", { name: new RegExp(`^${signedInUser.displayName} — Level `) }),
    ).toHaveAttribute("href", "/profile/progress");

    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    const drawer = page.getByRole("complementary", { name: "App navigation", exact: true });
    await expect(drawer).toBeVisible();
    const nav = drawer.getByRole("navigation", { name: "App", exact: true });
    await expect(nav).toBeVisible();

    const home = nav.getByRole("link", { name: "Home", exact: true });
    const chooseNog = nav.getByRole("link", { name: "Choose Your Nog", exact: true });
    const profileShop = nav.getByRole("link", { name: "Profile & Shop", exact: true });
    const hatch = drawer.getByRole("link", { name: "Hatch a Nog", exact: true });

    await expect(home).toHaveAttribute("href", "/home");
    await expect(home).toHaveAttribute("aria-current", "page");
    await expect(chooseNog).toHaveAttribute("href", "/nogs");
    await expect(chooseNog).not.toHaveAttribute("aria-current", "page");
    await expect(profileShop).toHaveAttribute("href", "/profile/progress");
    await expect(hatch).toHaveAttribute("href", "/adopt");

    if (mobile) {
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.scrollingElement!.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

      for (const link of [home, chooseNog, profileShop, hatch]) {
        const bounds = await link.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(44);
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }
    }

    await drawer.getByRole("button", { name: "Close menu", exact: true }).click();
    await expect(drawer).toBeHidden();
  });

  test(`Home has no serious or critical axe violations on ${label}`, async ({ page, signedInUser }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/home");

    await expect(
      page.getByRole("link", { name: new RegExp(`^${signedInUser.displayName} — Level `) }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Hatch your first Nog" })).toHaveAttribute(
      "href",
      "/adopt",
    );
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations.filter(({ impact }) => impact === "serious" || impact === "critical");
    expect(blocking.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);
  });
}

test("the skip link receives focus first and targets the Home content", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeVisible();

  await page.keyboard.press("Tab");

  const skip = page.getByRole("link", { name: "Skip to content", exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute("href", "#main");
  await expect(page.getByRole("main")).toHaveAttribute("id", "main");
});

test("the navigation drawer supports keyboard dismissal and logs out", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/home");

  const menuButton = page.getByRole("button", { name: "Open menu", exact: true });
  await menuButton.focus();
  await menuButton.press("Enter");

  const drawer = page.getByRole("complementary", { name: "App navigation", exact: true });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
});
