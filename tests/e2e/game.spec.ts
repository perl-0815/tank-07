import { expect, test, type Page } from "@playwright/test";
import { expectChronologicalLogTimes, openChoices } from "./helpers";

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

async function selectReply(page: Page, name: RegExp, final = false) {
  await readyForInput(page);
  const choices = await openChoices(page);
  await choices.getByRole("button", { name }).click();
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
  await expect(page.getByRole("log")).toContainText("水槽07の事故前の録音");
  await expect(page.getByRole("log")).toContainText("まだ、違う答えがある");
  await page.getByRole("button", { name: "もう一度接続する", exact: true }).click();
  await readyForInput(page);
  await keyword(page, "7319");
  const choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /音声ログを確認/ })).toHaveClass(/record-choice/);
  await expect(choices.getByRole("button", { name: /生体反応は/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the hidden handover requires explicit free-text confirmation and can end a fresh connection", async ({ page }) => {
  await connect(page);
  await expect(page.getByRole("button", { name: "記録 00", exact: true })).toBeVisible();
  const choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /応答を引き継ぐ|私がユナです/ })).toHaveCount(0);
  await expect(page.locator('#known-keywords option[value="応答を引き継ぐ"], #known-keywords option[value="私がユナです"]')).toHaveCount(0);
  await keyword(page, "私がユナです");
  await expect(page.getByText("ECHO END", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("引継ぎの要求は受信していません");
  await keyword(page, "応答を引き継ぐ");
  await expect(page.getByText("ECHO END", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("この操作は脱出のための通信を終了");
  await openChoices(page);
  await expect(choices.getByRole("button")).toHaveCount(1);
  await expect(choices.getByRole("button", { name: /引継ぎを取り消す/ })).toBeEnabled();
  await expect(page.locator('#known-keywords option[value="応答を引き継ぐ"], #known-keywords option[value="私がユナです"]')).toHaveCount(0);
  await keyword(page, "私がユナです", true);
  await expect(page.getByText("ECHO END", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AUX-07 / RESPONSE ARCHIVE", exact: true })).toBeVisible();
  await expect(page.locator(".ending-report")).toContainText("RESPONDER YOU");
  await expect(page.locator(".ending-report")).toContainText("REPLAY QUEUED");
  await expect(page.locator(".clock-caption")).toHaveText("通信終了");
  const timer = page.getByRole("timer");
  await expect(timer).toHaveText(/^\d{2}:\d{2}$/);
  const endingTime = await timer.textContent();
  await expect(timer).toHaveAttribute("aria-label", /^通信終了時の残り時間 /);
  await page.clock.install();
  await page.clock.fastForward(181000);
  await expect(timer).toHaveText(endingTime ?? "");
  await expect(page.getByRole("dialog", { name: "通信が途絶えました", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "もう一度接続する", exact: true }).click();
  await page.clock.runFor(1600);
  await page.clock.resume();
  await readyForInput(page);
  await keyword(page, "私がユナです");
  await expect(page.getByText("ECHO END", { exact: true })).toHaveCount(0);
  await keyword(page, "7319");
  await expect(page.getByRole("log")).toContainText("EMERGENCY POWER ONLINE");
});

test("a mistaken handover reply keeps confirmation pending and cancellation restores ordinary actions", async ({ page }) => {
  await connect(page);
  await keyword(page, "今どこ？");
  await keyword(page, "応答を引き継ぐ");
  await keyword(page, "まだ決められない");
  await expect(page.getByRole("log")).toContainText("引継ぎは、まだ確定していません");
  const choices = await openChoices(page);
  await expect(choices.getByRole("button")).toHaveCount(1);
  await expect(choices.getByRole("button", { name: /引継ぎを取り消す/ })).toBeEnabled();
  await expect(page.getByText("ECHO END", { exact: true })).toHaveCount(0);
  await selectReply(page, /引継ぎを取り消す/);
  await openChoices(page);
  await expect(choices.getByRole("button", { name: /引継ぎを取り消す/ })).toHaveCount(0);
  await expect(choices.getByRole("button", { name: /扉を壊せない/ })).toBeVisible();
  await keyword(page, "7319");
  await expect(page.getByRole("log")).toContainText("EMERGENCY POWER ONLINE");
});

test("the handover confirmation does not pause the deadline or survive reconnection", async ({ page }) => {
  await connect(page);
  await keyword(page, "応答を引き継ぐ");
  await openChoices(page);
  await page.clock.install();
  await page.clock.fastForward(181000);
  const disconnected = page.getByRole("dialog", { name: "通信が途絶えました", exact: true });
  await expect(disconnected).toBeVisible();
  await expect(disconnected.getByRole("button", { name: "再接続する", exact: true })).toBeFocused();
  await disconnected.getByRole("button", { name: "再接続する", exact: true }).click();
  await page.clock.runFor(1600);
  await page.clock.resume();
  await readyForInput(page);
  const choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /引継ぎを取り消す/ })).toHaveCount(0);
  await keyword(page, "7319");
  await expect(page.getByRole("log")).toContainText("EMERGENCY POWER ONLINE");
  await expect(page.getByText("ECHO END", { exact: true })).toHaveCount(0);
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
  let choices = await openChoices(page);
  const choose = async (name: RegExp, fromRecord = false) => {
    await readyForInput(page);
    choices = await openChoices(page);
    const button = choices.getByRole("button", { name });
    await expect(button).toBeEnabled();
    if (fromRecord) {
      await expect(button).toHaveClass(/record-choice/);
      await expect(button).toContainText("記録より");
    }
    await button.click();
    await readyForInput(page);
    await expect(page.getByRole("button", { name: "選択肢を開く", exact: true })).toHaveAttribute("aria-expanded", "false");
  };

  await expect(choices.locator(".record-choice")).toHaveCount(0);
  await choose(/聞こえる/);
  await choose(/逃げられない/);
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /第2機械室へ行って/ })).toHaveCount(0);
  await choose(/非常電源はどこ/);
  await choose(/第2機械室へ行って/, true);
  await expect(page.getByRole("log")).not.toContainText("なんで場所を知ってるの");
  const terminalImage = page.getByRole("button", { name: "IMG_04 非常電源端末を拡大", exact: true }).getByRole("img");
  await expect(terminalImage).toHaveAttribute("src", /\/_next\/image\?/);
  await expect.poll(() => terminalImage.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)).toBe(true);
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /7319 を入力/ })).toHaveCount(0);
  await choose(/コードを探して/);
  await choose(/7319 を入力/, true);
  await expect(page.getByRole("log")).not.toContainText("あなた何者");
  await expect(page.getByRole("log")).not.toContainText("本当に通った");
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /中央管理端末にアクセス/ })).toHaveCount(0);
  await choose(/操作できる設備を調べる/);
  await choose(/中央管理端末にアクセス/, true);
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /排水ポンプを停止/ })).toHaveCount(0);
  await expect(choices.getByRole("button", { name: /隔離プロトコルを解除/ })).toHaveCount(0);
  await choose(/圧力制御を確認/);
  await choose(/第7区画の排水ポンプを停止/, true);
  await choose(/隔離プロトコルを解除/, true);
  choices = await openChoices(page);
  await choices.getByRole("button", { name: /開ける/ }).click();
  await expect(page.getByText("SECRET END", { exact: true })).toBeVisible();
  await expectChronologicalLogTimes(page);
  await page.getByRole("button", { name: "もう一度接続する", exact: true }).click();
  await readyForInput(page);
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /第2機械室へ行って/ })).toHaveClass(/record-choice/);
});

test("suggestions reveal situational actions only after the relevant conversation", async ({ page }) => {
  await connect(page);
  let choices = await openChoices(page);
  for (const name of [/聞こえる/, /誰/, /何が起き/, /今どこ/]) {
    await expect(choices.getByRole("button", { name })).toBeVisible();
  }
  for (const name of [/信じて/, /扉を壊せない/, /非常電源はどこ/, /水槽07って何/, /第2機械室へ/]) {
    await expect(choices.getByRole("button", { name })).toHaveCount(0);
  }

  await choices.getByRole("button", { name: /何が起き/ }).click();
  await readyForInput(page);
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /信じて/ })).toHaveCount(0);
  await expect(choices.getByRole("button", { name: /非常電源はどこ/ })).toBeVisible();
  await expect(choices.getByRole("button", { name: /水槽07って何/ })).toBeVisible();
  await expect(choices.getByRole("button", { name: /扉を壊せない/ })).toHaveCount(0);

  await choices.getByRole("button", { name: /今どこ/ }).click();
  await readyForInput(page);
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /扉を壊せない/ })).toBeVisible();
});

test("the choice drawer opens all available actions and supports keyboard selection without losing a draft", async ({ page }) => {
  await connect(page);
  await keyword(page, "聞こえる");
  await keyword(page, "逃げられない？");
  const input = page.getByRole("combobox", { name: "キーワード", exact: true });
  const open = page.getByRole("button", { name: "選択肢を開く", exact: true });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await input.fill("入力中の下書き");
  await open.focus();
  await page.keyboard.press("Enter");
  const choices = await openChoices(page);
  expect(await choices.getByRole("button").count()).toBeGreaterThan(4);
  await expect(choices.getByRole("button", { name: /戻る|設備や周囲について聞く|施設について聞く/ })).toHaveCount(0);
  await expect(input).toBeEditable();
  await expect(input).toHaveValue("入力中の下書き");
  await expect(input).toBeInViewport();

  const location = choices.getByRole("button", { name: /今どこ/ });
  await location.focus();
  await page.keyboard.press("Escape");
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(open).toBeFocused();
  await expect(input).toHaveValue("入力中の下書き");

  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "選択肢を閉じる", exact: true })).toHaveAttribute("aria-expanded", "true");
  await location.focus();
  await page.keyboard.press("Enter");
  await readyForInput(page);
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("log")).toContainText("第4研究区画");
  await expect(input).toHaveValue("入力中の下書き");
  expect(await page.evaluate(() => {
    const focused = document.activeElement;
    return focused?.id === "keyword" || focused?.getAttribute("aria-controls") !== null && focused?.getAttribute("aria-expanded") === "false";
  })).toBe(true);

  await openChoices(page);
  await input.fill("非常電源はどこ？");
  await page.keyboard.press("Enter");
  await readyForInput(page);
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(input).toHaveValue("");
  await expect(page.getByRole("log")).toContainText("第2機械室");
});

test("deadline closes an expanded choice drawer and reconnect keeps it closed", async ({ page }) => {
  await connect(page);
  await openChoices(page);
  await page.clock.install();
  await page.clock.fastForward(181000);
  const disconnected = page.getByRole("dialog", { name: "通信が途絶えました", exact: true });
  await expect(disconnected).toBeVisible();
  await expect(page.locator(".choices")).not.toBeVisible();
  await expect(disconnected.getByRole("button", { name: "再接続する", exact: true })).toBeFocused();
  await disconnected.getByRole("button", { name: "再接続する", exact: true }).click();
  await page.clock.runFor(1600);
  await page.clock.resume();
  await readyForInput(page);
  await expect(page.getByRole("button", { name: "選択肢を開く", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".choices")).not.toBeVisible();
});

test("new code suggestions remain unavailable until YUNA finishes transmitting", async ({ page }) => {
  await connect(page);
  await keyword(page, "第2機械室へ");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".station")).not.toHaveClass(/reduced-motion/);
  const clockStart = Date.now();
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(clockStart + 1000);
  const choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /7319 を入力/ })).toHaveCount(0);
  await choices.getByRole("button", { name: /コードを探して/ }).click();
  const toggle = page.getByRole("button", { name: "選択肢を開く", exact: true });
  await expect(page.getByRole("region", { name: "通信操作" })).toHaveAttribute("aria-busy", "true");
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(choices).not.toBeVisible();
  await expect(toggle).toBeFocused();
  for (const key of ["Enter", "Space"]) {
    await page.keyboard.press(key);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(choices).not.toBeVisible();
  }
  await page.clock.resume();
  await readyForInput(page);
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeFocused();
  await openChoices(page);
  await expect(choices.getByRole("button", { name: /7319 を入力/ })).toBeVisible();
});

test("an incoming event closes an open choice drawer until transmission completes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await connect(page);
  const clockStart = Date.now();
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(clockStart + 1000);
  const choices = await openChoices(page);
  await choices.getByRole("button").first().focus();
  await page.clock.fastForward(60000);
  const toggle = page.getByRole("button", { name: "選択肢を開く", exact: true });
  await expect(page.getByRole("region", { name: "通信操作" })).toHaveAttribute("aria-busy", "true");
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(choices).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(choices).not.toBeVisible();
  await page.clock.resume();
  await readyForInput(page);
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("log")).toContainText("PRESSURE DROP DETECTED");
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

test("a retired navigation keyword does not lock subsequent valid commands", async ({ page }) => {
  await connect(page);
  await keyword(page, "戻る");
  await keyword(page, "7319");
  await expect(page.getByRole("log")).toContainText("EMERGENCY POWER ONLINE");
});

test("spoken investigation clues and remembered buttons lead to TRUE without typing a command", async ({ page }) => {
  await connect(page);
  for (const name of [/聞こえる/, /何が起きた/, /非常電源はどこ/, /第2機械室へ行って/, /コードを探して/, /7319 を入力/, /水槽07を確認する/]) {
    await selectReply(page, name);
  }
  await expect(page.getByRole("log")).toContainText("生体センサー");
  await expect(page.getByRole("log")).toContainText("事故前の録音");
  await selectReply(page, /生体反応は/);
  await selectReply(page, /音声ログを確認/);

  await page.clock.install();
  const nextLoop = async () => {
    await page.clock.fastForward(181000);
    const disconnected = page.getByRole("dialog", { name: "通信が途絶えました", exact: true });
    await expect(disconnected).toBeVisible();
    await disconnected.getByRole("button", { name: "再接続する", exact: true }).click();
    await page.clock.runFor(1600);
    await page.clock.resume();
    await readyForInput(page);
  };
  await nextLoop();
  await selectReply(page, /第2機械室へ行って/);
  await selectReply(page, /7319 を入力/);
  let choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /音声ログを確認/ })).toBeVisible();
  await expect(choices.getByRole("button", { name: /生体反応は/ })).toBeVisible();
  await selectReply(page, /監視ログを見る/);
  await selectReply(page, /次の映像を見る/);
  const entriesBeforeIdentity = await page.getByRole("log").locator(".log-entry").count();
  await selectReply(page, /君、本当にユナ？/);
  const entries = await page.getByRole("log").locator(".log-entry").allTextContents();
  expect(entries.slice(entriesBeforeIdentity).join("\n")).toContain("設備の一覧");
  for (const name of [/操作できる設備を調べる/, /中央管理端末にアクセス/, /圧力制御を確認/]) {
    await selectReply(page, name);
  }
  await nextLoop();
  for (const name of [/第2機械室へ行って/, /7319 を入力/, /第7区画の排水ポンプを停止/, /隔離プロトコルを解除/, /開ける/]) {
    await selectReply(page, name);
  }
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /君は水槽07/ })).toBeEnabled();
  await selectReply(page, /君は水槽07/, true);
  await expect(page.getByText("TRUE END", { exact: true })).toBeVisible();
  await expectChronologicalLogTimes(page);
});

test("learned investigation tools survive a reload and disappear after records are erased", async ({ page }) => {
  await connect(page);
  await keyword(page, "7319");
  await keyword(page, "水槽07");
  let choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /音声ログを確認/ })).toBeVisible();
  await expect(choices.getByRole("button", { name: /生体反応は/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "記録から再接続", exact: true }).click();
  await readyForInput(page);
  await keyword(page, "7319");
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /音声ログを確認/ })).toBeVisible();
  await expect(choices.getByRole("button", { name: /生体反応は/ })).toBeVisible();
  await expect(choices.getByRole("button", { name: /音声ログを確認/ })).toHaveClass(/record-choice/);
  await expect(choices.getByRole("button", { name: /生体反応は/ })).toHaveClass(/record-choice/);
  await expect(page.getByRole("log")).not.toContainText("水槽の中、真っ暗");

  await page.getByRole("button", { name: "操作案内", exact: true }).click();
  await page.getByRole("button", { name: "記録を消して最初から", exact: true }).click();
  await page.getByRole("button", { name: "消去して最初から", exact: true }).click();
  await expect(page.getByRole("button", { name: "記録 00", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await readyForInput(page);
  await keyword(page, "7319");
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /音声ログを確認|生体反応は/ })).toHaveCount(0);
});

test("optional free-text replies preserve normal play without granting records", async ({ page }) => {
  await connect(page);
  for (const value of ["SOS", "ありがとう", "こんにちは", "水槽08"]) await keyword(page, value);
  await expect(page.getByRole("button", { name: "記録 00", exact: true })).toBeVisible();
  await expect(page.getByRole("log")).not.toContainText("うまく聞き取れなかった");
  await expect(page.getByRole("log")).toContainText("DISTRESS RELAY UNAVAILABLE");
  await expect(page.getByRole("log")).toContainText("一緒にここから出よう");
  await expect(page.getByRole("log")).toContainText("ちゃんと届いてるよ");
  await expect(page.getByRole("log")).toContainText("観測水槽は七つまで");
  await expect(page.getByText("ECHO END", { exact: true })).toHaveCount(0);
  await keyword(page, "7319");
  await expect(page.getByRole("log")).toContainText("EMERGENCY POWER ONLINE");
});

test("investigating surveillance without reassurance completes TRUE across two loops", async ({ page }) => {
  await connect(page);
  await keyword(page, "7319");
  await keyword(page, "音声ログ");
  await keyword(page, "生体反応");
  await page.clock.install();
  await page.clock.fastForward(181000);
  await page.getByRole("button", { name: "再接続する", exact: true }).click();
  await page.clock.runFor(1600);
  await page.clock.resume();
  await openChoices(page);
  await keyword(page, "7319");
  for (const name of [/監視ログを見る/, /次の映像を見る/, /君、本当にユナ？/]) {
    const choices = await openChoices(page);
    await choices.getByRole("button", { name }).click();
    await readyForInput(page);
  }
  await expect(page.getByRole("log")).toContainText("INCIDENT BUFFER RECONSTRUCTION");
  await keyword(page, "第7区画の排水ポンプを停止");
  await keyword(page, "隔離プロトコルを解除");
  await keyword(page, "開ける");
  // An otherwise recognized facility command has no meaning in the final call.
  // It must not leave the client mutation lock set for the actual last question.
  await keyword(page, "7319");
  await keyword(page, "応答を引き継ぐ");
  const choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /引継ぎを取り消す/ })).toHaveCount(0);
  await expect(choices.getByRole("button", { name: /君は水槽07/ })).toBeEnabled();
  await choices.getByRole("button", { name: /君は水槽07/ }).click();
  await expect(page.getByText("TRUE END", { exact: true })).toBeVisible();
  await expect(page.getByRole("log")).toContainText("あなたに");
  await expect(page.getByRole("button", { name: /IMG_10/ })).toBeVisible();
  await expect(page.getByRole("log").locator(".speaker-you").filter({ hasText: "信じて" })).toHaveCount(0);
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

test("selected responses remain usable and their markers survive reload until records are erased", async ({ page }) => {
  await connect(page);
  let choices = await openChoices(page);
  const hello = choices.getByRole("button", { name: /聞こえる/ });
  await expect(hello).not.toHaveClass(/selected-choice/);
  await selectReply(page, /聞こえる/);
  choices = await openChoices(page);
  await expect(hello).toHaveClass(/selected-choice/);
  await expect(hello).toContainText("選択済み");
  await expect(hello).toBeEnabled();
  await expect(hello.locator(".choice-cost")).toHaveAttribute("aria-label", "所要2秒");
  await expect(choices.getByRole("button", { name: /誰？/ })).not.toHaveClass(/selected-choice/);
  await selectReply(page, /聞こえる/);
  await expect(page.getByRole("log")).toContainText("回線はまだ繋がってるよ");

  await page.reload();
  await page.getByRole("button", { name: "記録から再接続", exact: true }).click();
  await readyForInput(page);
  choices = await openChoices(page);
  await expect(hello).toHaveClass(/selected-choice/);
  await expect(hello.locator(".choice-cost")).toHaveAttribute("aria-label", "所要3秒");
  await expect(choices.getByRole("button", { name: /誰？/ })).not.toHaveClass(/selected-choice/);
  await hello.focus();
  await page.keyboard.press("Enter");
  await readyForInput(page);
  await expect(page.getByRole("log")).toContainText("よかった");

  await page.getByRole("button", { name: "操作案内", exact: true }).click();
  await page.getByRole("button", { name: "記録を消して最初から", exact: true }).click();
  await page.getByRole("button", { name: "消去して最初から", exact: true }).click();
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await readyForInput(page);
  choices = await openChoices(page);
  await expect(choices.locator(".selected-choice")).toHaveCount(0);
});

test("older records and malformed selection history restore without inventing discoveries", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "接続を開始", exact: true })).toBeEnabled();
  await page.evaluate(() => localStorage.setItem("abyssal-7.memory.v1", JSON.stringify({ facts: ["F02", "F03"], loop: 2, seen: [] })));
  await page.reload();
  await page.getByRole("button", { name: "記録から再接続", exact: true }).click();
  await readyForInput(page);
  let choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /第2機械室へ行って/ })).toBeEnabled();
  await expect(choices.locator(".selected-choice")).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem("abyssal-7.memory.v1", JSON.stringify({ facts: [], loop: 3, seen: [], selectedActions: ["hello", "hello", "audio", "not-an-action", 1, null] })));
  await page.reload();
  await page.getByRole("button", { name: "記録から再接続", exact: true }).click();
  await readyForInput(page);
  choices = await openChoices(page);
  await expect(choices.getByRole("button", { name: /聞こえる/ })).toHaveClass(/selected-choice/);
  await expect(choices.getByRole("button", { name: /音声ログ|第2機械室/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "記録 00", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("abyssal-7.memory.v1")!).selectedActions)).toEqual(["hello", "audio"]);
});
