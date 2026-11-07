import { test, expect } from "@playwright/test";

// The test server has no Stripe keys (.env.test): payments are off, so the pricing page does not exist (ruling R20).
// Its content with payments on is the template's (pricing.tsx); the plans must be replaced before enabling them.
test.describe("Pricing page", () => {
  test("is a 404 in the site's own page while payments are off", async ({ page }) => {
    const response = await page.goto("/pricing");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Página no encontrada" })).toBeVisible();
  });
});
