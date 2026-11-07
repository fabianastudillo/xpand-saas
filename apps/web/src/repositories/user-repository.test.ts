import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.hoisted(() => vi.fn());
vi.mock("@/libs/prisma", () => ({ default: { user: { upsert } } }));

import { createOrPromoteAdmin } from "./user-repository";

describe("createOrPromoteAdmin", () => {
  beforeEach(() => upsert.mockReset().mockResolvedValue({}));

  it("creates the administrator when the e-mail does not exist", async () => {
    await createOrPromoteAdmin({ email: "admin@example.org", name: "admin" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "admin@example.org" },
        create: expect.objectContaining({ email: "admin@example.org", role: UserRole.ADMIN }),
      }),
    );
  });

  it("promotes an existing user: the update sets the ADMIN role", async () => {
    await createOrPromoteAdmin({ email: "admin@example.org", name: "admin" });
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({ update: { role: UserRole.ADMIN } });
  });

  it("lower-cases the e-mail (Auth.js normalises it)", async () => {
    await createOrPromoteAdmin({ email: "Admin@Example.ORG", name: "admin" });
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { email: "admin@example.org" },
      create: { email: "admin@example.org" },
    });
  });
});
