import { expect, test, type Page } from "@playwright/test";

async function readyForInput(page: Page) {
  await expect(page.getByRole("region", { name: "通信操作" })).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("combobox", { name: "キーワード", exact: true })).toBeEditable();
}

async function connect(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await readyForInput(page);
}

async function keyword(page: Page, value: string, final = false) {
  await readyForInput(page);
  await page.getByRole("combobox", { name: "キーワード", exact: true }).fill(value);
  await page.getByRole("button", { name: "キーワードを送信" }).click();
  if (!final) await readyForInput(page);
}

async function clearRoute(page: Page) {
  await keyword(page, "７３１９");
  await keyword(page, "第7区画の排水ポンプを停止");
  await keyword(page, "隔離プロトコルを解除");
  await keyword(page, "開ける", true);
}

test("unknown correct commands complete SECRET, reconnect completes NORMAL", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await connect(page);
  await expect(page.getByRole("button", { name: "記録 00" })).toBeVisible();
  await clearRoute(page);
  await expect(page.getByText("SECRET END", { exact: true })).toBeVisible();
  await expect(page.getByText("今度は早かったね", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "もう一度接続する" }).click();
  await readyForInput(page);
  await clearRoute(page);
  await expect(page.getByText("NORMAL END", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("deadline preserves memory and enables reconnect; image dialog restores focus", async ({ page }) => {
  await connect(page);
  await keyword(page, "今どこ？");
  const image = page.getByRole("button", { name: "IMG_01 第4研究区画を拡大" });
  await image.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const expandedImage = page.getByRole("dialog").getByRole("img");
  await expect(expandedImage).toBeVisible();
  await expect.poll(() => expandedImage.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(image).toBeFocused();
  await page.clock.install();
  await page.clock.fastForward(181000);
  const disconnected = page.getByRole("dialog", { name: "通信が途絶えました", exact: true });
  await expect(disconnected).toBeVisible();
  await expect(disconnected.getByRole("button", { name: "再接続する", exact: true })).toBeFocused();
  await disconnected.getByRole("button", { name: "通信ログを見返す", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.clock.runFor(50);
  await expect(page.getByRole("log")).toBeFocused();
  await page.getByRole("button", { name: "記録", exact: false }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "第4研究区画" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "再接続する", exact: true }).click();
  await page.clock.runFor(1400);
  await expect(page.getByRole("timer")).toContainText("03:00");
  await expect(page.getByRole("log")).toContainText("聞こえる？");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.clock.fastForward(181000);
  await expect(disconnected).toBeVisible();
  await expect(disconnected.getByRole("button", { name: "再接続する", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.clock.runFor(50);
  await expect(page.getByRole("log")).toBeFocused();
  await expect(page.getByRole("button", { name: "再接続する", exact: true })).toBeVisible();
});

for (const motion of ["reduced", "standard", "manual-reduced"] as const) {
  test(`disconnect backdrop honors ${motion} motion preference`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion === "reduced" ? "reduce" : "no-preference" });
    await connect(page);
    if (motion === "manual-reduced") {
      await page.getByRole("button", { name: "操作案内", exact: true }).click();
      await page.getByRole("button", { name: "演出 標準", exact: true }).click();
      await expect(page.getByRole("button", { name: "演出 控えめ", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await page.clock.install();
    await page.clock.fastForward(181000);
    const disconnected = page.getByRole("dialog", { name: "通信が途絶えました", exact: true });
    await expect(disconnected).toBeVisible();
    await expect(disconnected.getByRole("button", { name: "再接続する", exact: true })).toBeFocused();
    expect(await disconnected.evaluate((element) => getComputedStyle(element, "::backdrop").animationName))
      .toBe(motion === "standard" ? "disconnection-noise" : "none");
  });
}

for (const panel of ["image", "help", "memory"] as const) {
  test(`deadline replaces the ${panel} dialog and reconnect clears the old panel`, async ({ page }) => {
    await connect(page);
    await keyword(page, "今どこ？");
    if (panel === "image") {
      await page.getByRole("button", { name: "IMG_01 第4研究区画を拡大", exact: true }).click();
    } else {
      await page.getByRole("button", { name: panel === "help" ? "操作案内" : "記録 01", exact: true }).click();
    }
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.clock.install();
    await page.clock.fastForward(181000);
    const disconnected = page.getByRole("dialog", { name: "通信が途絶えました", exact: true });
    await expect(disconnected).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    const reconnect = disconnected.getByRole("button", { name: "再接続する", exact: true });
    await expect(reconnect).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(disconnected.getByRole("button", { name: "通信ログを見返す", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(reconnect).toBeFocused();
    await page.keyboard.press("Enter");
    await page.clock.runFor(1600);
    await page.clock.resume();
    await readyForInput(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("log")).toContainText("聞こえる？");
    await expect(page.getByRole("button", { name: "記録 02", exact: true })).toBeVisible();
  });
}

test("recorded information reveals marked choices and supports a complete button-only rescue", async ({ page }) => {
  await connect(page);
  const choices = page.locator(".choices");
  const choose = async (name: RegExp, fromRecord = false) => {
    await readyForInput(page);
    const button = choices.getByRole("button", { name });
    await expect(button).toBeEnabled();
    if (fromRecord) {
      await expect(button).toHaveClass(/record-choice/);
      await expect(button).toContainText("記録より");
    }
    await button.click();
    await readyForInput(page);
  };

  await expect(choices.locator(".record-choice")).toHaveCount(0);
  await choose(/聞こえる/);
  await choose(/設備や周囲について聞く/);
  await expect(choices.getByRole("button", { name: /第2機械室へ行って/ })).toHaveCount(0);
  await choose(/非常電源はどこ/);
  await choose(/第2機械室へ行って/, true);
  await expect(choices.getByRole("button", { name: /7319 を入力/ })).toHaveCount(0);
  await choose(/コードを探して/);
  await choose(/7319 を入力/, true);
  await expect(choices.getByRole("button", { name: /中央管理端末にアクセス/ })).toHaveCount(0);
  await choose(/操作できる設備を調べる/);
  await choose(/中央管理端末にアクセス/, true);
  await expect(choices.getByRole("button", { name: /排水ポンプを停止/ })).toHaveCount(0);
  await expect(choices.getByRole("button", { name: /隔離プロトコルを解除/ })).toHaveCount(0);
  await choose(/圧力制御を確認/);
  await choose(/第7区画の排水ポンプを停止/, true);
  await choose(/隔離プロトコルを解除/, true);
  await choices.getByRole("button", { name: /開ける/ }).click();
  await expect(page.getByText("SECRET END", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "もう一度接続する", exact: true }).click();
  await readyForInput(page);
  await expect(choices.getByRole("button", { name: /第2機械室へ行って/ })).toHaveClass(/record-choice/);
});

test("an incorrect release order interrupts immediately with the reconnect dialog", async ({ page }) => {
  await connect(page);
  await keyword(page, "7319");
  await keyword(page, "隔離プロトコルを解除");
  await keyword(page, "開ける", true);
  const disconnected = page.getByRole("dialog", { name: "通信が途絶えました", exact: true });
  await expect(disconnected).toBeVisible();
  await expect(disconnected.getByRole("button", { name: "再接続する", exact: true })).toBeFocused();
  await disconnected.getByRole("button", { name: "通信ログを見返す", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("PRESSURE DIFFERENTIAL EXCEEDED");
  await expect(page.getByRole("timer")).not.toContainText("00:00");
  await expect(page.getByText("SECRET END", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "再接続する", exact: true })).toBeVisible();
});

test("record persistence, invalid input, keyboard send and 320px layout", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await connect(page);
  await keyword(page, "不明な合言葉");
  await expect(page.getByRole("log")).toContainText("うまく聞き取れなかった");
  await page.getByRole("combobox", { name: "キーワード", exact: true }).fill("今どこ？");
  await page.keyboard.press("Enter");
  await readyForInput(page);
  await expect(page.getByRole("button", { name: "記録 01" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, bottom: document.querySelector(".keyword-form")?.getBoundingClientRect().bottom, height: innerHeight }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.bottom).toBeLessThan(dimensions.height);
  await page.reload();
  await expect(page.getByRole("button", { name: "記録から再接続" })).toBeVisible();
  await expect(page.getByRole("button", { name: "記録 01" })).toBeVisible();
  await page.getByRole("button", { name: "記録から再接続" }).click();
  await readyForInput(page);
  await clearRoute(page);
  await expect(page.getByText("NORMAL END", { exact: true })).toBeVisible();
});

test("exploration, two loops, and last question complete TRUE", async ({ page }) => {
  await connect(page);
  await keyword(page, "7319");
  await keyword(page, "音声ログ");
  await keyword(page, "生体反応");
  await page.clock.install();
  await page.clock.fastForward(181000);
  await page.getByRole("button", { name: "再接続する", exact: true }).click();
  await page.clock.runFor(1600);
  await page.clock.resume();
  await keyword(page, "7319");
  await keyword(page, "信じて");
  await keyword(page, "信じて");
  await keyword(page, "監視ログ");
  await keyword(page, "5分前");
  await keyword(page, "君、本当にユナ？");
  await keyword(page, "第7区画の排水ポンプを停止");
  await keyword(page, "隔離プロトコルを解除");
  await keyword(page, "開ける");
  await expect(page.getByRole("button", { name: /君は水槽07/ })).toBeEnabled();
  await page.getByRole("button", { name: /君は水槽07/ }).click();
  await expect(page.getByText("TRUE END", { exact: true })).toBeVisible();
  await expect(page.getByRole("log")).toContainText("あなたに");
  await expect(page.getByRole("button", { name: /IMG_10/ })).toBeVisible();
});

test("brief effects clear and fast reconnection leaves controls usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await connect(page);
  await page.clock.install();
  await page.clock.fastForward(61000);
  await page.clock.runFor(4000);
  await expect(page.locator(".terminal")).not.toHaveClass(/event-glitch/);
  await page.clock.fastForward(181000);
  await page.getByRole("button", { name: "再接続する", exact: true }).click();
  await page.clock.runFor(2000);
  await expect(page.locator(".blackout")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "キーワード", exact: true })).toBeEditable();
  await keyword(page, "7319");
  await expect(page.getByRole("log")).toContainText("EMERGENCY POWER ONLINE");
});

test("reset during the first loop clears memory, input and playback position", async ({ page }) => {
  await connect(page);
  await keyword(page, "7319");
  await page.getByRole("combobox", { name: "キーワード", exact: true }).fill("古い入力");
  await page.getByRole("button", { name: "操作案内", exact: true }).click();
  await page.getByRole("button", { name: "記録を消して最初から", exact: true }).click();
  await page.getByRole("button", { name: "消去して最初から", exact: true }).click();
  await expect(page.getByRole("button", { name: "記録 00", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "操作案内", exact: true }).click();
  await page.getByRole("button", { name: "演出 控えめ", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await page.clock.runFor(950);
  await expect(page.getByText("YUNA 受信中…")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "キーワード", exact: true })).toHaveValue("");
  await page.clock.runFor(1000);
  await expect(page.getByRole("log")).toContainText("聞こえる？");
});
