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
  await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(image).toBeFocused();
  await page.clock.install();
  await page.clock.fastForward(181000);
  await expect(page.getByRole("button", { name: "再接続する", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "記録", exact: false }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "第4研究区画" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "再接続する", exact: true }).click();
  await page.clock.runFor(1400);
  await expect(page.getByRole("timer")).toContainText("03:00");
  await expect(page.getByRole("log")).toContainText("聞こえる？");
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
