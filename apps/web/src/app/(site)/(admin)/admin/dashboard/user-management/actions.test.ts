import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole } from "@prisma/client";

vi.mock("@/libs/auth/auth-utils", () => ({ getIsAdmin: vi.fn() }));
vi.mock("@/repositories/user-repository", () => ({
  getManyUsers: vi.fn(),
  toggleUserAccessByEmail: vi.fn(),
  updateUserRoleByEmail: vi.fn(),
}));

import { getIsAdmin } from "@/libs/auth/auth-utils";
import {
  getManyUsers,
  toggleUserAccessByEmail,
  updateUserRoleByEmail,
} from "@/repositories/user-repository";
import {
  getUsersAction,
  toggleUserAccessAction,
  updateUserRoleAction,
} from "./actions";

const formulario = (campos: Record<string, string>) => {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(campos)) datos.append(clave, valor);
  return datos;
};

describe("user-management actions", () => {
  beforeEach(() => {
    vi.mocked(getIsAdmin).mockReset();
    vi.mocked(getManyUsers).mockReset();
    vi.mocked(toggleUserAccessByEmail).mockReset();
    vi.mocked(updateUserRoleByEmail).mockReset();
  });

  describe("when the caller is not an admin", () => {
    beforeEach(() => {
      vi.mocked(getIsAdmin).mockResolvedValue(false);
    });

    it("getUsersAction returns no users and does not query the repository", async () => {
      await expect(getUsersAction()).resolves.toEqual([]);
      expect(getManyUsers).not.toHaveBeenCalled();
    });

    it("toggleUserAccessAction refuses and does not touch the user", async () => {
      const resultado = await toggleUserAccessAction(null, formulario({ email: "a@b.c" }));
      expect(resultado.error).toBe(true);
      expect(toggleUserAccessByEmail).not.toHaveBeenCalled();
    });

    it("updateUserRoleAction refuses and does not change the role", async () => {
      const resultado = await updateUserRoleAction(
        null,
        formulario({ email: "a@b.c", roleToUpdate: UserRole.ADMIN }),
      );
      expect(resultado.error).toBe(true);
      expect(updateUserRoleByEmail).not.toHaveBeenCalled();
    });
  });

  describe("when the caller is an admin", () => {
    beforeEach(() => {
      vi.mocked(getIsAdmin).mockResolvedValue(true);
      vi.mocked(getManyUsers).mockResolvedValue([]);
    });

    it("getUsersAction queries the repository", async () => {
      await getUsersAction();
      expect(getManyUsers).toHaveBeenCalledTimes(1);
    });

    it("toggleUserAccessAction toggles the user by email", async () => {
      const resultado = await toggleUserAccessAction(null, formulario({ email: "a@b.c" }));
      expect(resultado.error).toBe(false);
      expect(toggleUserAccessByEmail).toHaveBeenCalledWith("a@b.c");
    });

    it("updateUserRoleAction accepts a role of the UserRole enum", async () => {
      const resultado = await updateUserRoleAction(
        null,
        formulario({ email: "a@b.c", roleToUpdate: UserRole.USER }),
      );
      expect(resultado.error).toBe(false);
      expect(updateUserRoleByEmail).toHaveBeenCalledWith("a@b.c", UserRole.USER);
    });

    it("updateUserRoleAction rejects a role outside the UserRole enum", async () => {
      const resultado = await updateUserRoleAction(
        null,
        formulario({ email: "a@b.c", roleToUpdate: "SUPERUSER" }),
      );
      expect(resultado.error).toBe(true);
      expect(updateUserRoleByEmail).not.toHaveBeenCalled();
    });
  });
});
