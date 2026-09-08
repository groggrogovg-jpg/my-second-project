import { expect, test, type Locator, type Page } from "@playwright/test";

const CARD_ID = "mobile-layout-card";
const TEST_IMAGE =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#345678"/></svg>',
  ).toString("base64");

const generation = {
  id: CARD_ID,
  status: "done",
  notes: "",
  aspectRatio: "1:1",
  gptAnalysis: {
    title: "Мобильный заголовок",
    benefits: ["Преимущество"],
    callToAction: "Купить",
  },
  backgroundImageUrl: null,
  resultImageUrl: TEST_IMAGE,
  originalImageUrl: null,
};

const phones = [
  { name: "iPhone SE", portrait: { width: 375, height: 667 } },
  { name: "Pixel", portrait: { width: 412, height: 915 } },
] as const;

async function mockApis(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "mobile-user", nano2Balance: 1, proBalance: 0 }),
    }),
  );
  await page.route("**/api/generations", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify([generation]) }),
  );
  await page.route("**/api/generation/*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(generation) }),
  );
}

async function expectCanvasInsideWorkspace(canvas: Locator, workspace: Locator) {
  await expect(canvas).toBeVisible();
  await expect(workspace).toBeVisible();
  await expect
    .poll(async () => {
      const [canvasBox, workspaceBox] = await Promise.all([
        canvas.boundingBox(),
        workspace.boundingBox(),
      ]);
      if (!canvasBox || !workspaceBox) return false;
      const tolerance = 1;
      return (
        canvasBox.x >= workspaceBox.x - tolerance &&
        canvasBox.y >= workspaceBox.y - tolerance &&
        canvasBox.x + canvasBox.width <= workspaceBox.x + workspaceBox.width + tolerance &&
        canvasBox.y + canvasBox.height <= workspaceBox.y + workspaceBox.height + tolerance
      );
    })
    .toBe(true);
}

async function expectToolbarSeparateAndScrollable(
  canvas: Locator,
  toolbar: Locator,
  scrollArea: Locator,
) {
  await expect(toolbar).toBeVisible();
  const [canvasBox, toolbarBox] = await Promise.all([canvas.boundingBox(), toolbar.boundingBox()]);
  expect(canvasBox).not.toBeNull();
  expect(toolbarBox).not.toBeNull();
  const overlaps =
    canvasBox!.x < toolbarBox!.x + toolbarBox!.width &&
    canvasBox!.x + canvasBox!.width > toolbarBox!.x &&
    canvasBox!.y < toolbarBox!.y + toolbarBox!.height &&
    canvasBox!.y + canvasBox!.height > toolbarBox!.y;
  expect(overlaps, "панель инструментов не должна перекрывать холст").toBe(false);

  await expect
    .poll(() =>
      scrollArea.evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      })),
    )
    .toMatchObject({ overflowY: "auto" });
  const dimensions = await scrollArea.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  await scrollArea.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
}

async function checkLayoutAfterRotation(
  page: Page,
  viewport: { width: number; height: number },
  canvas: Locator,
  workspace: Locator,
  toolbar: Locator,
  scrollArea: Locator,
) {
  await page.setViewportSize(viewport);
  await expectCanvasInsideWorkspace(canvas, workspace);
  await expectToolbarSeparateAndScrollable(canvas, toolbar, scrollArea);

  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expectCanvasInsideWorkspace(canvas, workspace);
  await expectToolbarSeparateAndScrollable(canvas, toolbar, scrollArea);
}

for (const phone of phones) {
  test(`${phone.name}: редактор готовой карточки не обрезается после поворота`, async ({ page }) => {
    await mockApis(page);
    await page.setViewportSize(phone.portrait);
    await page.goto(`/editor/${CARD_ID}`);
    await page.getByRole("button", { name: "Элементы" }).click();
    await page.getByTestId("sidebar-edit-background").click();

    await checkLayoutAfterRotation(
      page,
      phone.portrait,
      page.getByTestId("card-editor-canvas"),
      page.getByTestId("card-editor-workspace"),
      page.getByTestId("card-editor-toolbar"),
      page.getByTestId("card-editor-toolbar-scroll"),
    );
  });

  test(`${phone.name}: редактор изображения не обрезается после поворота`, async ({ page }) => {
    await mockApis(page);
    await page.setViewportSize(phone.portrait);
    await page.goto("/app");
    await page.getByText("Мобильный заголовок", { exact: true }).first().click();
    await page.getByTestId("button-edit").click();

    await checkLayoutAfterRotation(
      page,
      phone.portrait,
      page.getByTestId("image-editor-canvas"),
      page.getByTestId("image-editor-workspace"),
      page.getByTestId("image-editor-toolbar"),
      page.getByTestId("image-editor-toolbar-scroll"),
    );
  });
}