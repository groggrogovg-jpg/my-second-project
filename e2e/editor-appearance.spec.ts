import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const CARD_A = "appearance-card-a";
const CARD_B = "appearance-card-b";
const CUSTOM_BACKGROUND =
  "data:image/svg+xml;base64," +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="#123456" d="M0 0h2v2H0z"/></svg>').toString("base64");

const analysis = {
  title: "Тестовый заголовок",
  benefits: ["Тестовая плашка"],
  callToAction: "Купить",
};

function generation(id: string) {
  return {
    id,
    status: "done",
    notes: "",
    gptAnalysis: analysis,
    backgroundImageUrl: null,
    resultImageUrl: null,
    originalImageUrl: null,
  };
}

async function mockEditorApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/generation/*", (route) => {
    const id = route.request().url().split("/").pop() || CARD_A;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(generation(id)),
    });
  });
}

async function mockDownloadableEditorApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "export-user", nano2Balance: 1, proBalance: 0 }),
    }),
  );
  await page.route("**/api/generation/*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(generation(CARD_A)),
    }),
  );
}

async function colorLayerBounds(
  png: Buffer,
  label: string,
  matches: (red: number, green: number, blue: number) => boolean,
) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const [red, green, blue] = data.subarray(offset, offset + 3);
      if (matches(red, green, blue)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  expect(maxX, `${label} должна присутствовать в PNG`).toBeGreaterThanOrEqual(0);
  return { minX, minY, maxX, maxY, width: info.width, height: info.height };
}

async function openBackgroundEditor(page: Page) {
  const editor = page.getByTestId("background-editor");
  if (!(await editor.isVisible().catch(() => false))) {
    await page.getByTestId("sidebar-edit-background").click();
  }
  await expect(editor).toBeVisible();
  return editor;
}

async function chooseElement(page: Page, text: string) {
  await page.getByText(text, { exact: true }).last().click();
}

async function setVisibleColor(page: Page, label: string, color: string) {
  const input = page.getByLabel(`${label}: выбор цвета`);
  await input.fill(color);
  await expect(input).toHaveValue(color);
}

test("оформление восстанавливается, сбрасывается и изолировано между карточками", async ({ page }) => {
  await mockEditorApi(page);
  await page.goto(`/editor/${CARD_A}`);

  const background = await openBackgroundEditor(page);
  await page.getByTestId("background-mode-color").click();
  await setVisibleColor(page, "Цвет фона", "#123456");

  await chooseElement(page, analysis.title);
  await setVisibleColor(page, "Цвет текста", "#abcdef");

  await chooseElement(page, analysis.benefits[0]);
  await setVisibleColor(page, "Фон плашки", "#fedcba");

  await page.getByTestId("input-background-image").setInputFiles({
    name: "custom-background.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="#123456" d="M0 0h2v2H0z"/></svg>'),
  });
  await expect(background).toHaveAttribute("data-background-mode", "image");
  await expect(page.getByTestId("custom-background-preview")).toHaveAttribute("src", CUSTOM_BACKGROUND);

  await page.waitForTimeout(400);
  await page.reload();

  const restoredBackground = await openBackgroundEditor(page);
  await expect(restoredBackground).toHaveAttribute("data-background-mode", "image");
  await expect(restoredBackground).toHaveAttribute("data-background-color", "#123456");
  await expect(restoredBackground).toHaveAttribute("data-has-custom-background", "true");
  await expect(page.getByTestId("custom-background-preview")).toHaveAttribute("src", CUSTOM_BACKGROUND);
  await chooseElement(page, analysis.title);
  await expect(page.getByLabel("Цвет текста: выбор цвета")).toHaveValue("#abcdef");
  await chooseElement(page, analysis.benefits[0]);
  await expect(page.getByLabel("Фон плашки: выбор цвета")).toHaveValue("#fedcba");

  await page.goto(`/editor/${CARD_B}`);
  const otherBackground = await openBackgroundEditor(page);
  await expect(otherBackground).toHaveAttribute("data-background-mode", "generated");
  await expect(otherBackground).toHaveAttribute("data-background-color", "#1a1a2e");
  await expect(otherBackground).toHaveAttribute("data-has-custom-background", "false");
  await chooseElement(page, analysis.title);
  await expect(page.getByLabel("Цвет текста: выбор цвета")).toHaveValue("#ffffff");
  await chooseElement(page, analysis.benefits[0]);
  await expect(page.getByLabel("Фон плашки: выбор цвета")).toHaveValue("#7c3aed");

  await page.goto(`/editor/${CARD_A}`);
  const customizedBackground = await openBackgroundEditor(page);
  await expect(customizedBackground).toHaveAttribute("data-has-custom-background", "true");
  await page.getByTestId("button-reset-appearance").click();
  await expect(customizedBackground).toHaveAttribute("data-background-mode", "color");
  await expect(customizedBackground).toHaveAttribute("data-background-color", "#1a1a2e");
  await expect(customizedBackground).toHaveAttribute("data-has-custom-background", "false");
  await chooseElement(page, analysis.title);
  await expect(page.getByLabel("Цвет текста: выбор цвета")).toHaveValue("#ffffff");
  await chooseElement(page, analysis.benefits[0]);
  await expect(page.getByLabel("Фон плашки: выбор цвета")).toHaveValue("#7c3aed");
});

test("последняя правка сохраняется при немедленном уходе из редактора", async ({ page }) => {
  await mockEditorApi(page);
  await page.goto(`/editor/${CARD_A}`);

  await openBackgroundEditor(page);
  await page.getByTestId("background-mode-color").click();
  await page.getByLabel("Цвет фона: выбор цвета").evaluate((input) => {
    const colorInput = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(colorInput, "#445566");
    colorInput.dispatchEvent(new Event("input", { bubbles: true }));
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });
  await page.goto(`/editor/${CARD_B}`);
  await page.goto(`/editor/${CARD_A}`);

  const restoredBackground = await openBackgroundEditor(page);
  await expect(restoredBackground).toHaveAttribute("data-background-mode", "color");
  await expect(restoredBackground).toHaveAttribute("data-background-color", "#445566");
});

test("большой пользовательский фон сохраняется без переполнения синхронного журнала", async ({ page }) => {
  await mockEditorApi(page);
  await page.goto(`/editor/${CARD_A}`);

  const background = await openBackgroundEditor(page);
  await page.getByTestId("input-background-image").setInputFiles({
    name: "large-background.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(6 * 1024 * 1024, 1),
  });
  await expect(background).toHaveAttribute("data-background-mode", "image");
  await page.reload();

  const restoredBackground = await openBackgroundEditor(page);
  await expect(restoredBackground).toHaveAttribute("data-background-mode", "image");
  await expect(restoredBackground).toHaveAttribute("data-has-custom-background", "true");
});

test("недоступный localStorage не прерывает сохранение в IndexedDB", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("kardomatik-editor-pending:")) {
        throw new DOMException("Storage is unavailable", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });
  await mockEditorApi(page);
  await page.goto(`/editor/${CARD_A}`);

  await openBackgroundEditor(page);
  await page.getByTestId("background-mode-color").click();
  await setVisibleColor(page, "Цвет фона", "#778899");
  await expect(page.getByTestId("background-editor")).toHaveAttribute("data-background-color", "#778899");
  await page.waitForTimeout(300);
  await page.reload();

  const restoredBackground = await openBackgroundEditor(page);
  await expect(restoredBackground).toHaveAttribute("data-background-mode", "color");
  await expect(restoredBackground).toHaveAttribute("data-background-color", "#778899");
  expect(pageErrors).toEqual([]);
});

test("PNG сохраняет размеры и позиции слоёв в квадратном и вертикальном форматах", async ({ page }) => {
  await mockDownloadableEditorApi(page);
  await page.goto(`/editor/${CARD_A}`);
  await expect(page.getByTestId("button-download")).toBeEnabled();
  await expect(page.getByText(analysis.benefits[0], { exact: true }).last()).toBeVisible();

  const formats = [
    { id: "square-standard", width: 500, height: 500 },
    { id: "portrait-standard", width: 900, height: 1200 },
  ] as const;

  for (const format of formats) {
    await page.getByTestId(`format-${format.id}`).click();
    await page.getByTestId("button-apply-format").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("button-download").click();
    const download = await downloadPromise;
    const png = await download.createReadStream().then(async (stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    });

    const badge = await colorLayerBounds(
      png,
      "фиолетовая плашка",
      (red, green, blue) =>
        red >= 105 && red <= 145 &&
        green >= 35 && green <= 85 &&
        blue >= 210 && blue <= 255,
    );
    const cta = await colorLayerBounds(
      png,
      "зелёная CTA-плашка",
      (red, green, blue) =>
        red <= 25 &&
        green >= 125 && green <= 175 &&
        blue >= 80 && blue <= 130,
    );
    expect([badge.width, badge.height]).toEqual([format.width, format.height]);

    const scaleX = format.width / 800;
    const scaleY = format.height / 800;
    expect(badge.minX).toBeCloseTo(40 * scaleX, 0);
    expect(badge.minY).toBeCloseTo(120 * scaleY, 0);
    expect(badge.maxX).toBeLessThan(format.width - 1);
    expect(badge.maxY).toBeLessThan(format.height - 1);
    expect(badge.maxX - badge.minX).toBeGreaterThan(250 * scaleX);
    expect(badge.maxY - badge.minY).toBeGreaterThan(20 * scaleY);

    expect(cta.minX).toBeCloseTo(40 * scaleX, 0);
    expect(Math.abs(cta.minY - 700 * scaleY)).toBeLessThanOrEqual(1);
    expect(cta.maxX).toBeLessThan(format.width - 1);
    expect(cta.maxY).toBeLessThan(format.height - 1);
  }
});