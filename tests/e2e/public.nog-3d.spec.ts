import { expect, test, type Locator, type Page, type Response } from "@playwright/test";

test.use({
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

const landing = {
  path: "/",
  scenes: [{
    name: "Three Nogs waving: a round baby Nog and two sprouting Nogs",
    poster: "landing-trio",
    belowFold: false,
  }],
} as const;

const discover = {
  path: "/discover",
  scenes: [
    { name: "A sprouting Nog flying with a book", poster: "flying-book", belowFold: false },
    { name: "A Nog thinking", poster: "thinking", belowFold: true },
    { name: "A Nog peeking out of its eggshell", poster: "egg-peek", belowFold: true },
  ],
} as const;

type Scene = (typeof landing.scenes | typeof discover.scenes)[number];

type Frame = {
  draws: number;
  firstDraw: { state: string | null; posterVisible: boolean };
};

declare global {
  interface Window {
    nogTestFrames: WeakMap<HTMLCanvasElement, Frame>;
    nogTestWebGLRequests: number;
  }
}

function nogStage(page: Page, scene: Scene) {
  return page.getByRole("img", { name: scene.name, exact: true });
}

async function scrollToStage(stage: Locator) {
  // The poster can be moving while its canvas loads.
  await stage.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
}

async function expectPoster(stage: Locator, scene: Scene) {
  const poster = stage.locator("img");
  await expect(stage).toHaveAttribute("data-nog-3d", "poster");
  await expect(poster).toHaveAttribute("alt", "");
  await expect(poster).toHaveAttribute(
    "src",
    new RegExp(`(?:%2F|/)nog(?:%2F|/)${scene.poster}\\.png(?:&|$)`),
  );
  await expect.poll(() => poster.evaluate((image: HTMLImageElement) =>
    image.naturalWidth > 0 && image.checkVisibility({ opacityProperty: true }),
  )).toBe(true);
}

async function trackWebGLDraws(page: Page) {
  await page.addInitScript(() => {
    window.nogTestFrames = new WeakMap();

    function recordDraw(context: WebGLRenderingContext | WebGL2RenderingContext) {
      const canvas = context.canvas;
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const stage = canvas.closest("[data-nog-3d]");
      if (!stage) return;

      const frame = window.nogTestFrames.get(canvas);
      if (frame) {
        frame.draws++;
        return;
      }

      window.nogTestFrames.set(canvas, {
        draws: 1,
        firstDraw: {
          state: stage.getAttribute("data-nog-3d"),
          posterVisible: stage.querySelector("img")?.checkVisibility({ opacityProperty: true }) ?? false,
        },
      });
    }

    for (const { prototype } of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const { drawArrays, drawElements } = prototype;
      prototype.drawArrays = function (...args: Parameters<typeof drawArrays>) {
        drawArrays.apply(this, args);
        recordDraw(this);
      };
      prototype.drawElements = function (...args: Parameters<typeof drawElements>) {
        drawElements.apply(this, args);
        recordDraw(this);
      };
    }
  });
}

async function frameCount(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) =>
    window.nogTestFrames.get(element)?.draws ?? 0,
  );
}

async function waitForBrowserFrames(page: Page, frames: number) {
  await page.evaluate((frameCount) => new Promise<void>((resolve) => {
    let remaining = frameCount;
    function nextFrame() {
      remaining--;
      if (remaining === 0) resolve();
      else requestAnimationFrame(nextFrame);
    }
    requestAnimationFrame(nextFrame);
  }), frames);
}

test.describe("live Nog scenes", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    reducedMotion: "no-preference",
  });

  test.beforeEach(async ({ page }) => {
    await trackWebGLDraws(page);
  });

  for (const { path, scenes } of [landing, discover]) {
    for (const scene of scenes) {
      test(`${path} renders ${scene.poster} in an accessible WebGL canvas`, async ({ page }) => {
        await page.goto(path);
        const stage = nogStage(page, scene);
        const canvas = stage.locator("canvas");
        if (scene.belowFold) {
          await expect(nogStage(page, discover.scenes[0])).toHaveAttribute("data-nog-3d", "ready");
          await expect(stage).not.toBeInViewport();
          await expect(stage).toHaveAttribute("data-nog-3d", "poster");
          await expect(canvas).toHaveCount(0);
        }

        await scrollToStage(stage);
        await expect(stage).toHaveAttribute("data-nog-3d", "ready");
        await expect(stage).toHaveAttribute("role", "img");
        await expect(stage).toHaveAttribute("aria-label", scene.name);
        await expect(stage).toHaveAccessibleName(scene.name);
        await expect(canvas).toHaveCount(1);
        await expect(canvas).toBeVisible();
        await expect(canvas).toHaveAttribute("aria-hidden", "true");

        const firstDraw = await canvas.evaluate((element: HTMLCanvasElement) =>
          window.nogTestFrames.get(element)?.firstDraw,
        );
        expect(firstDraw).toEqual({ state: "poster", posterVisible: true });

        const draws = await frameCount(canvas);
        await expect.poll(() => frameCount(canvas)).toBeGreaterThan(draws);
        await expect.poll(() => stage.locator("img").evaluateAll((images) =>
          images.some((image) => image.checkVisibility({ opacityProperty: true })),
        )).toBe(false);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      });
    }
  }

  test("Discover pauses off-screen rendering and resumes on return", async ({ page }) => {
    await page.goto(discover.path);
    const stage = nogStage(page, discover.scenes[0]);
    const canvas = stage.locator("canvas");
    await expect(stage).toHaveAttribute("data-nog-3d", "ready");

    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect(stage).not.toBeInViewport();
    await waitForBrowserFrames(page, 12);
    const pausedDraws = await frameCount(canvas);
    await waitForBrowserFrames(page, 12);
    expect(await frameCount(canvas)).toBe(pausedDraws);

    await scrollToStage(stage);
    await expect.poll(() => frameCount(canvas)).toBeGreaterThan(pausedDraws);
  });

  test("Home returns to the Figma poster when its WebGL context is lost", async ({ page }) => {
    await page.goto(landing.path);
    const scene = landing.scenes[0];
    const stage = nogStage(page, scene);
    await expect(stage).toHaveAttribute("data-nog-3d", "ready");

    await stage.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const extension = context?.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("Chromium cannot simulate WebGL context loss");
      extension.loseContext();
    });
    await expectPoster(stage, scene);
  });

  test("the shared layout does not load the Three.js code requested by a live scene", async ({ page }) => {
    const scripts: Response[] = [];
    page.on("response", (response) => {
      if (response.ok() && new URL(response.url()).pathname.endsWith(".js")) {
        scripts.push(response);
      }
    });

    async function requestedThree() {
      const sources = await Promise.all(scripts.map((response) => response.text()));
      // Three.js uses this marker to detect duplicate browser imports. Check the
      // downloaded code so an unused copy in a shared chunk also fails the test.
      return sources.some((source) => source.includes("__THREE__"));
    }

    const response = await page.goto("/nog-3d-test-missing-route");
    expect(response?.status()).toBe(404);
    expect(await requestedThree()).toBe(false);

    await page.goto(landing.path);
    await expect(nogStage(page, landing.scenes[0])).toHaveAttribute("data-nog-3d", "ready");
    await expect.poll(requestedThree).toBe(true);
  });
});

function testPosters(expectWebGLProbe = false) {
  for (const { path, scenes } of [landing, discover]) {
    test(`${path} keeps all named Figma posters without a canvas`, async ({ page }) => {
      await page.goto(path);
      for (const scene of scenes) {
        const stage = nogStage(page, scene);
        await scrollToStage(stage);
        await expectPoster(stage, scene);
      }
      if (expectWebGLProbe) {
        await expect.poll(() => page.evaluate(() => window.nogTestWebGLRequests)).toBeGreaterThan(0);
      }
      await expect(page.getByRole("main").locator("canvas")).toHaveCount(0);
    });
  }
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  testPosters();
});

test.describe("WebGL unavailable", () => {
  test.use({ reducedMotion: "no-preference" });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.nogTestWebGLRequests = 0;
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = new Proxy(getContext, {
        apply(target, canvas: HTMLCanvasElement, args: Parameters<typeof getContext>) {
          const [contextId] = args;
          if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") {
            window.nogTestWebGLRequests++;
            return null;
          }
          return target.apply(canvas, args);
        },
      });
    });
  });
  testPosters(true);
});

test.describe("JavaScript disabled", () => {
  test.use({ javaScriptEnabled: false });
  testPosters();
});
