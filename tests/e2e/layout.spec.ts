import { expect, test, type Page } from "@playwright/test";

async function readyForInput(page: Page) {
  await expect(page.getByRole("region", { name: "通信操作" })).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("combobox", { name: "キーワード", exact: true })).toBeEditable();
}

async function expectContainedByViewport(page: Page) {
  const viewport = page.viewportSize()!;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  const input = await page.getByRole("combobox", { name: "キーワード", exact: true }).boundingBox();
  const send = await page.getByRole("button", { name: "キーワードを送信" }).boundingBox();
  expect(input).not.toBeNull();
  expect(send).not.toBeNull();
  for (const box of [input!, send!]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
}

test("start screen explains the setting and opens into a centered full-screen terminal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop layout contract");
  await page.goto("/");
  const intro = page.locator(".standby");
  await expect(intro).toContainText("2089年、日本海溝の深度3,200m。");
  await expect(intro).toContainText("研究員・ユナ");
  await expect(intro).toContainText("回線がもつのは、3分。");
  await expect(intro).toContainText("得た情報を手がかりに、もう一度。");

  const terminal = page.getByRole("region", { name: "ABYSSAL-7 非常通信端末" });
  const startBox = await terminal.boundingBox();
  expect(startBox).toEqual({ x: 0, y: 0, width: 1440, height: 1000 });
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await readyForInput(page);
  expect(await terminal.boundingBox()).toEqual(startBox);

  const log = await page.locator(".log-content").boundingBox();
  const command = await page.locator(".command-content").boundingBox();
  const form = await page.locator(".keyword-form").boundingBox();
  expect(log).not.toBeNull();
  expect(command).not.toBeNull();
  expect(form).not.toBeNull();
  for (const box of [log!, command!, form!]) {
    expect(box.width).toBeLessThanOrEqual(760);
    expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThanOrEqual(1);
  }
  expect(Math.abs(log!.x - form!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(log!.width - form!.width)).toBeLessThanOrEqual(1);
  await expectContainedByViewport(page);
});

for (const width of [320, 390]) {
  test(`mobile ${width}px retains readable logs and usable input when viewport shortens`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile layout contract");
    await page.setViewportSize({ width, height: width === 320 ? 640 : 844 });
    await page.goto("/");
    const start = page.getByRole("button", { name: "接続を開始", exact: true });
    await expect(start).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await start.click();
    await readyForInput(page);
    await expectContainedByViewport(page);

    const input = page.getByRole("combobox", { name: "キーワード", exact: true });
    await input.fill("7319");
    await page.getByRole("button", { name: "キーワードを送信" }).click();
    await readyForInput(page);
    await expect(page.getByRole("log")).toContainText("EMERGENCY POWER ONLINE");

    // A reduced visual viewport reproduces the layout pressure of a mobile keyboard.
    await page.setViewportSize({ width, height: 420 });
    await input.focus();
    await expectContainedByViewport(page);
    const log = await page.getByRole("log").boundingBox();
    const commands = await page.getByRole("region", { name: "通信操作" }).boundingBox();
    expect(log).not.toBeNull();
    expect(commands).not.toBeNull();
    expect(log!.height).toBeGreaterThanOrEqual(96);
    expect(log!.y + log!.height).toBeLessThanOrEqual(commands!.y + 1);

    await input.fill("第7区画の排水ポンプを停止");
    await page.keyboard.press("Enter");
    await readyForInput(page);
    await expect(page.getByRole("log")).toContainText("DRAINAGE OFFLINE");
    await expect(page.getByRole("log").locator(".log-entry").last()).toBeInViewport();
    await expectContainedByViewport(page);

    await page.setViewportSize({ width, height: width === 320 ? 640 : 844 });
    await expectContainedByViewport(page);
  });
}

test("composing Japanese text does not send a keyword before composition ends", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await readyForInput(page);
  const input = page.getByRole("combobox", { name: "キーワード", exact: true });
  await input.fill("今どこ？");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(input).toHaveValue("今どこ？");
  await expect(page.getByRole("button", { name: "記録 00", exact: true })).toBeVisible();
  await input.dispatchEvent("compositionend");
  await input.press("Enter");
  await readyForInput(page);
  await expect(page.getByRole("button", { name: "記録 01", exact: true })).toBeVisible();
});

test("reconnecting clears unfinished composition from the previous input", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await readyForInput(page);
  const input = page.getByRole("combobox", { name: "キーワード", exact: true });
  await input.fill("未確定の入力");
  await input.dispatchEvent("compositionstart");
  await page.clock.install();
  await page.clock.fastForward(181000);
  await page.getByRole("button", { name: "再接続する", exact: true }).click();
  await page.clock.runFor(1600);
  await page.clock.resume();
  await readyForInput(page);
  await input.fill("7319");
  await page.getByRole("button", { name: "キーワードを送信" }).click();
  await readyForInput(page);
  await expect(page.getByRole("log")).toContainText("EMERGENCY POWER ONLINE");
});
