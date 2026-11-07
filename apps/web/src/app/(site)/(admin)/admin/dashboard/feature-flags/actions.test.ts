import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/libs/auth/auth-utils", () => ({ getIsAdmin: vi.fn() }));
vi.mock("@/repositories/feature-flags", () => ({
  getFeatureFlags: vi.fn(),
  createFeatureFlag: vi.fn(),
  getFeatureFlagByName: vi.fn(),
  updateFeatureFlag: vi.fn(),
  deleteFeatureFlag: vi.fn(),
}));

import { getIsAdmin } from "@/libs/auth/auth-utils";
import { getFeatureFlags } from "@/repositories/feature-flags";
import { getFeatureFlagsAction } from "./actions";

describe("getFeatureFlagsAction", () => {
  beforeEach(() => {
    vi.mocked(getIsAdmin).mockReset();
    vi.mocked(getFeatureFlags).mockReset();
  });

  it("returns no flags and does not query the repository when the caller is not an admin", async () => {
    vi.mocked(getIsAdmin).mockResolvedValue(false);
    await expect(getFeatureFlagsAction()).resolves.toEqual([]);
    expect(getFeatureFlags).not.toHaveBeenCalled();
  });

  it("queries the repository when the caller is an admin", async () => {
    vi.mocked(getIsAdmin).mockResolvedValue(true);
    vi.mocked(getFeatureFlags).mockResolvedValue([]);
    await getFeatureFlagsAction();
    expect(getFeatureFlags).toHaveBeenCalledTimes(1);
  });
});
