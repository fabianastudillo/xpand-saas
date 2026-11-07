import { test } from "@playwright/test";
import { testAccessibilityFor } from "../utils";

test.describe("Unauthenticated pages", () => {
  test("should not have any automatically detectable accessibility issues on home page", async ({
    page,
  }) => {
    await testAccessibilityFor("/", page);
  });

  test("should not have any automatically detectable accessibility issues on login page", async ({
    page,
  }) => {
    await testAccessibilityFor("/login", page);
  });

  test("should not have any automatically detectable accessibility issues on the privacy and terms pages", async ({
    page,
  }) => {
    await testAccessibilityFor("/privacy", page);
    await testAccessibilityFor("/terms", page);
  });

  // /pricing is a 404 while payments are off: its page is the public zone's not-found.
  test("should not have any automatically detectable accessibility issues on the page of an address without page", async ({
    page,
  }) => {
    await testAccessibilityFor("/pricing", page);
  });
});
