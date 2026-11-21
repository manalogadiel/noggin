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
  test(`Home shows only the ${label} app navigation and destinations`, async ({ page, signedInUser }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/home");

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: `Hi, ${signedInUser.displayName.split(" ")[0]}!` })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "App", exact: true });
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(mobile ? 3 : 2);
    await expect(page.getByRole("link", { name: /^(Arena|History)$/, includeHidden: true }))
      .toHaveCount(0);

    const home = nav.getByRole("link", { name: "Home", exact: true });
    const myNogs = nav.getByRole("link", { name: "My Nogs", exact: true });
    await expect(home).toHaveAttribute("href", "/home");
    await expect(home).toHaveAttribute("aria-current", "page");
    await expect(myNogs).toHaveAttribute("href", "/nogs");
    await expect(myNogs).not.toHaveAttribute("aria-current", "page");

    const hatch = nav.getByRole("link", { name: "Hatch a Nog", exact: true });
    if (mobile) {
      await expect(hatch).toHaveAttribute("href", "/adopt");
      for (const link of [home, myNogs, hatch]) {
        const bounds = await link.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(44);
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }
      expect((await nav.boundingBox())?.y).toBeGreaterThan(height - 120);
    } else {
      await expect(hatch).toHaveCount(0);
      const [navBounds, mainBounds] = await Promise.all([nav.boundingBox(), main.boundingBox()]);
      expect(navBounds && mainBounds && navBounds.x + navBounds.width <= mainBounds.x)
        .toBe(true);
    }
  });

  test(`Home has no serious or critical axe violations on ${label}`, async ({ page, signedInUser }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/home");

    await expect(page.getByRole("button", { name: `Account menu for ${signedInUser.displayName}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Hatch your first Nog" })).toHaveAttribute("href", "/adopt");
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

test("the skip link receives focus first and targets the Home content", async ({ page, signedInUser }) => {
  await page.goto("/home");
  await expect(page.getByRole("button", { name: `Account menu for ${signedInUser.displayName}` })).toBeVisible();

  await page.keyboard.press("Tab");

  const skip = page.getByRole("link", { name: "Skip to content", exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute("href", "#main");
  await expect(page.getByRole("main")).toHaveAttribute("id", "main");
});

test("the named account menu supports keyboard dismissal and logs out", async ({ page, signedInUser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/home");
  const account = page.getByRole("button", { name: `Account menu for ${signedInUser.displayName}` });
  await expect(account).toContainText(signedInUser.displayName);

  await account.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByText(signedInUser.displayName, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(account).toBeFocused();

  await account.click();
  await menu.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
});
