import { expect, type Page } from "@playwright/test";

export async function openChoices(page: Page) {
  const toggle = page.getByRole("button", { name: /^選択肢を(開く|閉じる)$/ });
  await expect(toggle).toBeEnabled();
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const controlledId = await toggle.getAttribute("aria-controls");
  expect(controlledId).toBeTruthy();
  await expect(page.locator(`[id="${controlledId}"]`)).toBeVisible();
  const choices = page.locator(".choices");
  await expect(choices).toBeVisible();
  await expect(choices.getByRole("button", { name: /信じて|応答を引き継ぐ|私がユナです/ })).toHaveCount(0);
  return choices;
}

export async function expectChronologicalLogTimes(page: Page) {
  const timestamps = await page.getByRole("log").locator("time").allTextContents();
  expect(timestamps.length).toBeGreaterThan(1);
  const seconds = timestamps.map((timestamp) => {
    expect(timestamp).toMatch(/^\+\d{2}:\d{2}$/);
    const [minutes, seconds] = timestamp.slice(1).split(":").map(Number);
    return minutes * 60 + seconds;
  });
  for (let index = 1; index < seconds.length; index += 1) {
    expect(seconds[index], `Log timestamp ${timestamps[index]} follows ${timestamps[index - 1]}`).toBeGreaterThanOrEqual(seconds[index - 1]);
  }
}
