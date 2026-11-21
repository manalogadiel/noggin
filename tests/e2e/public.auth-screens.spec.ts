import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { localAuthTest } from "./support/session";

type Credentials = { email: string; password: string };

const loginHeading = /^Hello, Welcome Back!$/i;
const signupHeading = /^Hatch your Nog$/i;
const loginError = "Check your email and password";
const ageError = /Your Nog is still snug in its shell! Noggin is for ages 16 and up\./i;
const adultBirthday = "2000-01-01";

const test = localAuthTest.extend<{ findSignupUser: () => Promise<{ id: string } | undefined> }>({
  findSignupUser: async ({ localAuth: { admin, credentials } }, runTest) => {
    const perPage = 100;
    async function findUser() {
      for (let page = 1; ; page++) {
        const { data, error } = await admin.listUsers({ page, perPage });
        if (error) {
          throw new Error(`Couldn't list local test accounts (${error.code ?? "unknown error"}).`);
        }
        const user = data.users.find(({ email }) => email === credentials.email);
        if (user || data.users.length < perPage) return user;
      }
    }

    try {
      await runTest(findUser);
    } finally {
      // If a rejected signup created an account, remove it even when the test failed.
      const user = await findUser();
      if (user) {
        const { error } = await admin.deleteUser(user.id);
        if (error) {
          throw new Error(`Couldn't delete the local signup account (${error.code ?? "unknown error"}).`);
        }
      }
    }
  },
});

test.use({ reducedMotion: "reduce" });

async function openPage(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.ok(), `${path} returned HTTP ${response?.status()}`).toBe(true);
  return page.getByRole("main");
}

function getField(main: Locator, name: string) {
  return main.getByLabel(new RegExp(`^${name}\\s*\\*?$`));
}

async function expectLabeledField(main: Locator, name: string, autocomplete: string) {
  const field = getField(main, name);
  await expect(field).toBeVisible();
  await expect(field).toHaveAccessibleName(name);
  expect(await field.evaluate((input: HTMLInputElement) =>
    Array.from(input.labels ?? []).some((label) => label.checkVisibility()),
  ), `${name} has a visible label`).toBe(true);
  await expect(field).toHaveAttribute("autocomplete", autocomplete);
  await expect(field).toHaveJSProperty("required", true);
  return field;
}

async function expectFieldError(field: Locator, message: RegExp) {
  if (await field.getAttribute("aria-errormessage")) {
    await expect(field).toHaveAccessibleErrorMessage(message);
  } else {
    await expect(field).toHaveAccessibleDescription(message);
  }
}

async function fillCredentials(main: Locator, { email, password }: Credentials) {
  await getField(main, "Email").fill(email);
  await getField(main, "Password").fill(password);
}

function privacyAgreement(main: Locator) {
  return main.getByRole("checkbox", { name: /Privacy notice/i });
}

async function submitSignup(main: Locator, credentials: Credentials, birthday: string) {
  await getField(main, "Your name").fill("Grace Hopper");
  await fillCredentials(main, credentials);
  await getField(main, "Birthday").fill(birthday);
  await privacyAgreement(main).check();
  await main.getByRole("button", { name: "Hatch my Nog", exact: true }).click();
}

async function expectSignedIn(page: Page) {
  const response = await page.request.get("/home", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
}

test("login shows the labeled card, leaning Nog and sign-up links", async ({ page }) => {
  const main = await openPage(page, "/login");

  await expect(main.getByRole("heading", { level: 1 })).toHaveAccessibleName(loginHeading);
  await expect(main.getByRole("img", { name: "A Nog waving hello", exact: true })).toBeVisible();
  const email = await expectLabeledField(main, "Email", "email");
  const password = await expectLabeledField(main, "Password", "current-password");
  await expect(email).toHaveAttribute("type", "email");
  await expect(password).toHaveAttribute("type", "password");
  await expect(main.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
  await expect(main.getByText(/New to Noggin\?/i)).toBeVisible();
  await expect(main.getByRole("link", { name: "Create an account", exact: true })).toHaveAttribute("href", "/signup");
  await expect(page.getByRole("link", { name: /Forgot password/i, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign up", exact: true })).toHaveAttribute("href", "/signup");
});

test("invalid credentials announce a field error and preserve the typed email", async ({ page, loginUser }) => {
  const main = await openPage(page, "/login");
  const { email, password } = loginUser.credentials;
  await fillCredentials(main, { email, password: `${password}-incorrect` });
  await main.getByRole("button", { name: "Log in", exact: true }).click();

  const alert = main.getByRole("alert").filter({ hasText: loginError });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  const emailField = getField(main, "Email");
  await expect(emailField).toHaveValue(email);
  const message = /Check your email and password/;
  await expectFieldError(emailField, message);
  await expectFieldError(getField(main, "Password"), message);
  await expect(page).toHaveURL("/login");
});

for (const next of ["", "/home?from=login"]) {
  const destination = next || "/nogs";
  test(`valid credentials land on ${destination}`, async ({ page, loginUser }) => {
    const path = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
    const main = await openPage(page, path);
    await fillCredentials(main, loginUser.credentials);
    await main.getByRole("button", { name: "Log in", exact: true }).click();

    await expect(page).toHaveURL(destination);
    await expectSignedIn(page);
  });
}

test("signup provides labeled fields, an eight-character minimum and required privacy consent", async ({ page }) => {
  const main = await openPage(page, "/signup");

  await expect(main.getByRole("heading", { level: 1 })).toHaveAccessibleName(signupHeading);
  await expectLabeledField(main, "Your name", "name");
  const email = await expectLabeledField(main, "Email", "email");
  await expect(email).toHaveAttribute("type", "email");
  const password = await expectLabeledField(main, "Password", "new-password");
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveJSProperty("minLength", 8);
  await expect(password).toHaveAccessibleDescription(/At least 8 characters/i);
  const birthday = await expectLabeledField(main, "Birthday", "bday");
  await expect(birthday).toHaveAttribute("type", "date");
  await expect(birthday).toHaveAccessibleDescription(/ages 16 and up/i);
  await expect(privacyAgreement(main)).toHaveAccessibleName(/agree to Noggin saving my lessons and progress/i);
  await expect(privacyAgreement(main)).toHaveJSProperty("required", true);
  await expect(privacyAgreement(main)).not.toBeChecked();
  await expect(main.getByRole("button", { name: "Hatch my Nog", exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Log in", exact: true })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("banner").getByRole("link", { name: "Log in", exact: true })).toHaveAttribute("href", "/login");
});

test("a valid signup creates an account and lands on adoption", async ({ page, localAuth, findSignupUser }) => {
  const main = await openPage(page, "/signup");
  await submitSignup(main, localAuth.credentials, adultBirthday);

  await expect(page).toHaveURL("/adopt");
  expect(await findSignupUser(), "Supabase Auth contains the submitted email").toBeDefined();
  await expectSignedIn(page);
});

test("under-16 signup announces the age rule and creates no Supabase account", async ({ page, localAuth, findSignupUser }) => {
  const main = await openPage(page, "/signup");
  const birthYear = new Date().getUTCFullYear() - 15;
  await submitSignup(main, localAuth.credentials, `${birthYear}-01-01`);

  const alert = main.getByRole("alert").filter({ hasText: ageError });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expectFieldError(getField(main, "Birthday"), ageError);
  await expect(page).toHaveURL("/signup");
  expect(await findSignupUser(), "Supabase Auth has no account for the underage signup email").toBeUndefined();
});

test("the signup privacy link opens the public notice", async ({ page }) => {
  const main = await openPage(page, "/signup");
  const link = main.getByRole("link", { name: "Privacy notice", exact: true });
  await expect(link).toHaveAttribute("href", "/privacy");
  await link.click();

  await expect(page).toHaveURL("/privacy");
  await expect(main.getByRole("heading", { level: 1 })).toHaveAccessibleName("Privacy notice");
  for (const section of [
    "Who we are", "What we collect", "Why", "Who helps us", "How long we keep it",
    "Your rights", "Age", "Security", "Contact",
  ]) {
    await expect(main.getByRole("heading", { level: 2, name: new RegExp(`^${section}\\b`, "i") })).toBeVisible();
  }
  for (const processor of ["Supabase", "Vercel", "Groq", "Gemini"]) {
    await expect(main.getByText(processor, { exact: false }).first()).toBeVisible();
  }
});

for (const path of ["/login", "/signup", "/privacy"]) {
  test(`${path} fits a 375 px viewport and has no serious or critical axe violations`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const main = await openPage(page, path);
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations
      .filter(({ impact }) => impact === "serious" || impact === "critical")
      .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) })),
    ).toEqual([]);
  });
}

test.describe("auth forms without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("login submits and establishes a session", async ({ page, loginUser }) => {
    const main = await openPage(page, "/login");
    await fillCredentials(main, loginUser.credentials);
    await main.getByRole("button", { name: "Log in", exact: true }).click();

    await expect(page).toHaveURL("/nogs");
    await expectSignedIn(page);
  });

  test("signup submits and creates an account", async ({ page, localAuth, findSignupUser }) => {
    const main = await openPage(page, "/signup");
    await submitSignup(main, localAuth.credentials, adultBirthday);

    await expect(page).toHaveURL("/adopt");
    expect(await findSignupUser(), "Supabase Auth contains the submitted email").toBeDefined();
  });
});
