import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./support/session";

const subjectHeading = "What should your Nog learn?";
const eggHeading = "Tap to hatch";
const meetHeading = "Meet your Nog";
const nameHeading = "What will you call me?";
const customSubject = "Marine Biology";
const quickPick = "Networking";
const hatchling = "Hatchling";
const phone = { width: 375, height: 812 };

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ signedInUser }) => {
  // Request the fixture so each test gets its own account and browser session.
  void signedInUser;
});

function heading(main: Locator, name: string) {
  return main.getByRole("heading", { name, level: 1, exact: true });
}

async function openAdoption(page: Page) {
  const response = await page.goto("/adopt");
  expect(response?.status(), "HTTP status for /adopt").toBe(200);
  await expect(page).toHaveURL("/adopt");
  const main = page.getByRole("main");
  await expect(heading(main, subjectHeading)).toBeVisible();
  return main;
}

async function openCollection(page: Page) {
  const response = await page.goto("/nogs");
  expect(response?.status(), "HTTP status for /nogs").toBe(200);
  await expect(page).toHaveURL("/nogs");
  const main = page.getByRole("main");
  await expect(heading(main, "My Nogs")).toBeVisible();
  return main;
}

async function startHatch(main: Locator) {
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await expect(heading(main, eggHeading)).toBeFocused();
}

async function tapEgg(main: Locator, activate: (egg: Locator, tap: number) => Promise<void>) {
  const egg = main.getByRole("button", { name: "Tap the egg", exact: true });
  await expect(egg).toBeVisible();
  await expect(main.getByLabel("Taps: 0 of 3", { exact: true })).toBeVisible();

  for (const tap of [1, 2]) {
    await activate(egg, tap);
    await expect(main.getByLabel(`Taps: ${tap} of 3`, { exact: true })).toBeVisible();
    await expect(heading(main, eggHeading)).toBeVisible();
  }

  await activate(egg, 3);
  await expect(heading(main, meetHeading)).toBeFocused();
  await expect(egg).toBeHidden();
}

async function openNaming(main: Locator) {
  await main.getByRole("button", { name: "Name your Nog", exact: true }).click();
  await expect(heading(main, nameHeading)).toBeFocused();
}

async function submitName(main: Locator, name: string) {
  await main.getByRole("textbox", { name: "Nog name", exact: true }).fill(name);
  await main.getByRole("button", { name: `Meet ${name}`, exact: true }).click();
}

async function expectNogRoom(page: Page, name: string, subject: string) {
  await expect(page).toHaveURL(/\/nogs\/[^/?#]+$/);
  const main = page.getByRole("main");
  await expect(heading(main, name)).toBeVisible();
  await expect(main.getByText(subject, { exact: true })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function hatchBySubject(page: Page, subject: string, name: string) {
  const main = await openAdoption(page);
  await main.getByRole("textbox", { name: "Subject", exact: true }).fill(subject);
  await startHatch(main);
  await tapEgg(main, (egg) => egg.click());
  await openNaming(main);
  await submitName(main, name);
}

function nogCard(main: Locator, name: string, subject: string) {
  return main.getByRole("link", { name: `${name}, ${subject}, ${hatchling}`, exact: true });
}

async function expectMobileLayoutAndAxe(page: Page, state: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const { contentWidth, viewportWidth } = await page.evaluate(() => ({
    contentWidth: document.scrollingElement!.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(viewportWidth).toBe(phone.width);
  expect(contentWidth, `${state} scroll width`).toBeLessThanOrEqual(viewportWidth);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) })),
  `${state} serious or critical axe violations`).toEqual([]);
}

test("a typed custom subject hatches after three egg clicks and opens the named Nog room", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await hatchBySubject(page, customSubject, "Coral");
  await expectNogRoom(page, "Coral", customSubject);
});

test("the Networking quick pick fills the subject and the egg hatches with Enter and Space", async ({ page }) => {
  const main = await openAdoption(page);
  const subject = main.getByRole("textbox", { name: "Subject", exact: true });
  await expect(subject).toHaveValue("");
  await main.getByRole("button", { name: quickPick, exact: true }).click();
  await expect(subject).toHaveValue(quickPick);

  await startHatch(main);
  const keys = ["Enter", "Space", "Enter"];
  await tapEgg(main, async (egg, tap) => {
    if (tap === 1) {
      await expect(egg).toHaveJSProperty("tabIndex", 0);
      await egg.focus();
    }
    await expect(egg).toBeFocused();
    await page.keyboard.press(keys[tap - 1]);
  });
  await openNaming(main);
  await submitName(main, "Packet");
  await expectNogRoom(page, "Packet", quickPick);
});

test("the server refuses a second Nog for the same subject and keeps the first", async ({ page }) => {
  await hatchBySubject(page, quickPick, "Packet");
  const room = await expectNogRoom(page, "Packet", quickPick);

  const main = await openAdoption(page);
  await main.getByRole("textbox", { name: "Subject", exact: true }).fill(quickPick);
  await startHatch(main);
  await tapEgg(main, (egg) => egg.click());
  await openNaming(main);
  await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === "/adopt",
    ),
    submitName(main, "Duplicate"),
  ]);

  await expect(page).toHaveURL("/adopt");
  await expect(heading(main, subjectHeading)).toBeFocused();
  const alert = main.getByRole("alert").filter({ hasText: /already/i });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/nog|subject|networking/i);

  const collection = await openCollection(page);
  await expect(nogCard(collection, "Packet", quickPick)).toHaveAttribute("href", room);
  await expect(collection.locator('a[href^="/nogs/"]')).toHaveCount(1);
  await expect(collection.getByText("Duplicate", { exact: true })).toHaveCount(0);
});

test("My Nogs shows hatchling cards with their subjects, stages and a Hatch New link", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await hatchBySubject(page, customSubject, "Coral");
  const coralRoom = await expectNogRoom(page, "Coral", customSubject);
  await hatchBySubject(page, quickPick, "Packet");
  const packetRoom = await expectNogRoom(page, "Packet", quickPick);

  const main = await openCollection(page);
  await expect(main.getByText("Your collection of Nogs.", { exact: true })).toBeVisible();
  const coral = nogCard(main, "Coral", customSubject);
  const packet = nogCard(main, "Packet", quickPick);
  const hatchNew = main.getByRole("link", { name: "Hatch New", exact: true });

  for (const { card, name, subject, room } of [
    { card: coral, name: "Coral", subject: customSubject, room: coralRoom },
    { card: packet, name: "Packet", subject: quickPick, room: packetRoom },
  ]) {
    await expect(card).toHaveAttribute("href", room);
    await expect(card.getByText(name, { exact: true })).toBeVisible();
    await expect(card.getByText(subject, { exact: true })).toBeVisible();
    await expect(card.getByText(hatchling, { exact: true })).toBeVisible();
    await expect(card.locator("img")).toBeVisible();
  }
  await expect(hatchNew).toHaveAttribute("href", "/adopt");
  const [coralBox, packetBox, hatchNewBox] = await Promise.all(
    [coral, packet, hatchNew].map((card) => card.evaluate((element) => {
      const { x, y } = element.getBoundingClientRect();
      return { x, y };
    })),
  );
  expect(coralBox.y).toBeCloseTo(hatchNewBox.y);
  expect(packetBox.y).toBeCloseTo(hatchNewBox.y);
  expect(hatchNewBox.x).toBeGreaterThan(Math.max(coralBox.x, packetBox.x));

  await page.setViewportSize(phone);
  await expectMobileLayoutAndAxe(page, "My Nogs with hatchlings");
  await hatchNew.click();
  await expect(page).toHaveURL("/adopt");
  await expect(heading(main, subjectHeading)).toBeVisible();
});

test("the empty My Nogs page invites a first hatch and passes the mobile and axe checks", async ({ page }) => {
  await page.setViewportSize(phone);
  const main = await openCollection(page);
  const firstHatch = main.getByRole("link", { name: "Hatch your first Nog", exact: true });
  await expect(firstHatch).toHaveAttribute("href", "/adopt");
  await expect(main.getByRole("link", { name: "Hatch New", exact: true })).toHaveCount(0);
  await expectMobileLayoutAndAxe(page, "Empty My Nogs");

  await firstHatch.click();
  await expect(page).toHaveURL("/adopt");
  await expect(heading(main, subjectHeading)).toBeVisible();
});

test("all four adoption steps fit at 375 px and have no serious or critical axe violations", async ({ page }) => {
  await page.setViewportSize(phone);
  const main = await openAdoption(page);
  await expectMobileLayoutAndAxe(page, subjectHeading);
  await main.getByRole("textbox", { name: "Subject", exact: true }).fill(customSubject);

  await startHatch(main);
  await expectMobileLayoutAndAxe(page, eggHeading);
  await tapEgg(main, (egg) => egg.click());
  await expectMobileLayoutAndAxe(page, meetHeading);

  await openNaming(main);
  await expect(main.getByText("Enter the name of your Nog", { exact: true })).toBeVisible();
  await expectMobileLayoutAndAxe(page, nameHeading);
});
