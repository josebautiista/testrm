import { test, expect } from "@playwright/test";

test("login redirect works", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
