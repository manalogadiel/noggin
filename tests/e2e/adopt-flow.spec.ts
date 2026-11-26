import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./support/session";

const eggHeading = "Tap to hatch";
const meetHeading = "Meet your Nog";
const customizeHeading = "Make your Nog Yours";
const notebookHeading = "Name your first notebook";
const customLesson = "Marine Ecosystems";
const quickIdea = "TCP Handshake";
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
  await expect(heading(main, eggHeading)).toBeVisible();
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

async function openCustomize(main: Locator) {
  await main.getByRole("button", { name: "Customize Your Nog →", exact: true }).click();
  await expect(heading(main, customizeHeading)).toBeFocused();
}

async function completeCustomize(main: Locator, name: string) {
  await main.getByRole("textbox", { name: "Nog Name", exact: true }).fill(name);
  await main.getByRole("button", { name: "Next: Name Your Notebook →", exact: true }).click();
  await expect(heading(main, notebookHeading)).toBeFocused();
}

async function submitFirstNotebook(main: Locator, lessonTitle: string) {
  await main.getByRole("textbox", { name: "Lesson Title", exact: true }).fill(lessonTitle);
  await main.getByRole("button", { name: "Create Notebook & Enter Room →", exact: true }).click();
}

async function expectNogRoom(page: Page, name: string) {
  await expect(page).toHaveURL(/\/nogs\/[^/?#]+$/);
  const main = page.getByRole("main");
  await expect(heading(main, name)).toBeVisible();
  return new URL(page.url()).pathname;
}

async function completeFullOnboarding(page: Page, name: string, lessonTitle: string) {
  const main = await openAdoption(page);
  await tapEgg(main, (egg) => egg.click());
  await openCustomize(main);
  await completeCustomize(main, name);
  await submitFirstNotebook(main, lessonTitle);
}

function nogCard(main: Locator, name: string, subject: string) {
  return main.getByRole("link", {
    name: `${name}, ${subject}, ${hatchling}, Lvl. 1`,
    exact: true,
  });
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

test("starts on Tap to hatch, customizes Nog, names first notebook, and lands in the Living Sanctuary", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await completeFullOnboarding(page, "Coral", customLesson);
  await expectNogRoom(page, "Coral");
});

test("supports keyboard egg hatching and quick lesson idea selection", async ({ page }) => {
  const main = await openAdoption(page);

  const keys = ["Enter", "Space", "Enter"];
  await tapEgg(main, async (egg, tap) => {
    if (tap === 1) {
      await expect(egg).toHaveJSProperty("tabIndex", 0);
      await egg.focus();
    }
    await expect(egg).toBeFocused();
    await page.keyboard.press(keys[tap - 1]);
  });
  await openCustomize(main);
  await completeCustomize(main, "Packet");

  const lessonInput = main.getByRole("textbox", { name: "Lesson Title", exact: true });
  await expect(lessonInput).toHaveValue("");
  await main.getByRole("button", { name: quickIdea, exact: true }).click();
  await expect(lessonInput).toHaveValue(quickIdea);

  await main.getByRole("button", { name: "Create Notebook & Enter Room →", exact: true }).click();
  await expectNogRoom(page, "Packet");
});

test("My Nogs shows hatchling cards with their notebooks, stages and a Hatch New link", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await completeFullOnboarding(page, "Coral", customLesson);
  const coralRoom = await expectNogRoom(page, "Coral");
  await completeFullOnboarding(page, "Packet", quickIdea);
  const packetRoom = await expectNogRoom(page, "Packet");

  const main = await openCollection(page);
  await expect(main.getByText(/OWNED:\s*2\s*\/\s*9/)).toBeVisible();
  const coral = nogCard(main, "Coral", customLesson);
  const packet = nogCard(main, "Packet", quickIdea);
  const hatchNew = main.getByRole("link", { name: "Hatch New", exact: true });

  for (const { card, name, room } of [
    { card: coral, name: "Coral", room: coralRoom },
    { card: packet, name: "Packet", room: packetRoom },
  ]) {
    await expect(card).toHaveAttribute("href", room);
    await expect(card.getByText(name, { exact: true })).toBeVisible();
    await expect(card.getByText("Lvl. 1", { exact: true })).toBeVisible();
    await expect(card.locator("img")).toBeVisible();
  }
  await expect(hatchNew).toHaveAttribute("href", "/adopt");

  await page.setViewportSize(phone);
  await expectMobileLayoutAndAxe(page, "My Nogs with hatchlings");
  await hatchNew.click();
  await expect(page).toHaveURL("/adopt");
  await expect(heading(main, eggHeading)).toBeVisible();
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
  await expect(heading(main, eggHeading)).toBeVisible();
});

test("all four onboarding steps fit at 375 px and have no serious or critical axe violations", async ({ page }) => {
  await page.setViewportSize(phone);
  const main = await openAdoption(page);
  await expectMobileLayoutAndAxe(page, eggHeading);
  await tapEgg(main, (egg) => egg.click());
  await expectMobileLayoutAndAxe(page, meetHeading);

  await openCustomize(main);
  await expectMobileLayoutAndAxe(page, customizeHeading);

  await completeCustomize(main, "Coral");
  await expectMobileLayoutAndAxe(page, notebookHeading);
});
