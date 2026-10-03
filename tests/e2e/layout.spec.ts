import { expect, test, type Page } from "@playwright/test";
import { openChoices } from "./helpers";

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
  await expect(intro).not.toContainText("得た情報を手がかりに、もう一度。");
  await expect(intro.locator(".tank-symbol")).toHaveCount(0);

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

    // Recorded suggestions add a label; they must still fit with a mobile keyboard.
    await input.fill("圧力制御");
    await page.keyboard.press("Enter");
    await readyForInput(page);
    await input.fill("中央管理端末");
    await page.keyboard.press("Enter");
    await readyForInput(page);
    const choices = await openChoices(page);
    expect(await choices.getByRole("button").count()).toBeGreaterThan(4);
    const lastChoice = choices.getByRole("button").last();
    await lastChoice.scrollIntoViewIfNeeded();
    await expect(lastChoice).toBeInViewport();
    const scrolledDrawer = await choices.evaluate((element) => {
      for (let node: HTMLElement | null = element as HTMLElement; node && node !== document.body; node = node.parentElement) {
        if (["auto", "scroll"].includes(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
          return { scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
        }
      }
      return null;
    });
    expect(scrolledDrawer).not.toBeNull();
    expect(scrolledDrawer!.scrollTop).toBeGreaterThan(0);
    expect(scrolledDrawer!.scrollHeight).toBeGreaterThan(scrolledDrawer!.clientHeight);
    const recordedRelease = choices.getByRole("button", { name: /隔離プロトコルを解除/ });
    await expect(recordedRelease).toHaveClass(/record-choice/);
    await expect(recordedRelease).toContainText("記録より");
    await recordedRelease.scrollIntoViewIfNeeded();
    await expect(recordedRelease).toBeInViewport();
    await expectContainedByViewport(page);
    const drawerBox = await choices.boundingBox();
    const inputBox = await input.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(inputBox).not.toBeNull();
    expect(drawerBox!.y).toBeGreaterThanOrEqual(0);
    expect(drawerBox!.y + drawerBox!.height).toBeLessThanOrEqual(inputBox!.y);
    await input.fill("展開中の入力");
    await expect(input).toHaveValue("展開中の入力");
    await page.getByRole("button", { name: "選択肢を閉じる", exact: true }).click();
    await expect(page.getByRole("button", { name: "選択肢を開く", exact: true })).toHaveAttribute("aria-expanded", "false");

    await page.setViewportSize({ width, height: width === 320 ? 640 : 844 });
    await expectContainedByViewport(page);
  });
}

test("header controls retain clear accessible names and keyboard-operable dialogs", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "端末メニュー" });
  const help = menu.getByRole("button", { name: "操作案内", exact: true });
  const memory = menu.getByRole("button", { name: "記録 00", exact: true });
  for (const button of [help, memory]) {
    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await help.focus();
  await page.keyboard.press("Enter");
  const helpDialog = page.getByRole("dialog", { name: "操作案内", exact: true });
  await expect(helpDialog).toBeVisible();
  await expect(helpDialog).not.toContainText("知っていることは、次の通信でも");
  await expect(helpDialog).not.toContainText("未取得でも直接入力で進めます");
  await expect(page.getByRole("dialog").getByRole("button", { name: "閉じる", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(help).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(memory).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "記録", exact: true })).toContainText("受信した情報が、ここに残ります。");
  await page.keyboard.press("Escape");
  await expect(memory).toBeFocused();
});

test("long YOU messages wrap inside the transcript at 320px and leave input usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await readyForInput(page);
  const input = page.getByRole("combobox", { name: "キーワード", exact: true });
  const longMessage = "通信内容を確認しています。".repeat(3) + "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(2);
  await input.fill(longMessage);
  await page.getByRole("button", { name: "キーワードを送信", exact: true }).click();
  await readyForInput(page);
  const message = page.getByRole("log").locator(".speaker-you p").filter({ hasText: longMessage });
  await expect(message).toHaveCount(1);
  const dimensions = await message.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(dimensions.height).toBeGreaterThan(dimensions.lineHeight * 2);
  await expectContainedByViewport(page);
  await input.fill("今どこ？");
  await page.keyboard.press("Enter");
  await readyForInput(page);
  await expect(page.getByRole("log")).toContainText("第4研究区画");
  await expectContainedByViewport(page);
});

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

test("overflow cues reveal hidden replies and track scrolling, resizing, and keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "接続を開始", exact: true }).click();
  await readyForInput(page);
  await openChoices(page);
  const down = page.getByRole("button", { name: "下に続き", exact: true });
  const up = page.getByRole("button", { name: "上に戻る", exact: true });
  await expect(down).toBeHidden();
  await expect(up).toBeHidden();

  const input = page.getByRole("combobox", { name: "キーワード", exact: true });
  for (const value of ["聞こえる", "7319", "水槽07", "中央管理端末", "通信回線"]) {
    await input.fill(value);
    await page.getByRole("button", { name: "キーワードを送信" }).click();
    await readyForInput(page);
  }
  const choices = await openChoices(page);
  await expect(down).toBeVisible();
  await expect(up).toBeHidden();
  await expect(down).toHaveAttribute("aria-controls", "choice-list");
  await down.click();
  await expect.poll(() => choices.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await expect(up).toBeVisible();
  const last = choices.getByRole("button").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await expect(down).toBeHidden();
  const beforeUp = await choices.evaluate((node) => node.scrollTop);
  await up.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => choices.evaluate((node) => node.scrollTop)).toBeLessThan(beforeUp);

  await page.setViewportSize({ width: 320, height: 640 });
  await choices.evaluate((node) => { node.scrollTop = 0; });
  await expect(down).toBeVisible();
  await expect(up).toBeHidden();
  // A single reply needs no scroll affordance, even at this narrow width.
  await input.fill("応答を引き継ぐ");
  await page.keyboard.press("Enter");
  await readyForInput(page);
  await openChoices(page);
  await expect(down).toBeHidden();
  await expect(up).toBeHidden();
  await expect(choices.getByRole("button")).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 420 });
  // visualViewport dispatches its resize event after setViewportSize resolves.
  await expect(input).toBeInViewport({ ratio: 1 });
  await expectContainedByViewport(page);
  await expect(choices.getByRole("button", { name: /引継ぎを取り消す/ })).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "選択肢を開く", exact: true })).toBeFocused();
  await expect(choices).toBeHidden();
});
