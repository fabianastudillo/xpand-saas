import { test, expect } from "@playwright/test";

import {
  navigateToFeatureFlagsDashboard,
  getFeatureFlagRowByName,
} from "./feature-flag-helpers";
import { featureFlags } from "../../../data/feature-flags";

const [, secondFeatureFlag] = featureFlags;

test.describe("Feature flags update", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToFeatureFlagsDashboard(page);
  });

  test("admin can update a feature flag", async ({ page }) => {
    const featureFlagRow = await getFeatureFlagRowByName(
      page,
      secondFeatureFlag.name,
    );

    // FEATURE_FLAG_2 is seeded disabled (tests/data/feature-flags.ts). The template's test expected it enabled
    // because createFeatureFlag turned every `false` into `true` (`isEnabled || true`), a bug fixed in Task 2.
    const toggleSwitch = featureFlagRow.getByRole("switch");

    await expect(toggleSwitch).not.toBeChecked();

    await toggleSwitch.click();

    await expect(toggleSwitch).toBeChecked();

    await expect(
      page.getByText(/Feature flag updated successfully/i),
    ).toBeVisible();
  });
});
