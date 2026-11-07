import { test, expect } from "@playwright/test";

test("the public navbar leads to the case explorer, which lists the public cases", async ({ page }) => {
  // arrange
  await page.goto("/");

  // act
  await page.getByRole("link", { name: "Explore cases" }).first().click();

  // assert: the zone is its own document, so this is a full navigation
  await expect(page).toHaveURL(/\/casos$/);
  await expect(page.getByRole("searchbox", { name: "Buscar sistema" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Sistemas" }).getByRole("link").first()).toBeVisible();
});

test("the case explorer shows no pages of the site around it", async ({ page }) => {
  await page.goto("/casos");

  await expect(page.getByRole("searchbox", { name: "Buscar sistema" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "main navbar" })).toHaveCount(0);
});
