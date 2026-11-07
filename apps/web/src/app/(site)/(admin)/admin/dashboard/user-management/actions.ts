"use server";

import { UserRole } from "@prisma/client";

import { getIsAdmin } from "@/libs/auth/auth-utils";
import {
  toggleUserAccessByEmail,
  getManyUsers,
  updateUserRoleByEmail,
} from "@/repositories/user-repository";

interface ActionResult {
  message: string;
  error: boolean;
}

const NOT_ALLOWED: ActionResult = {
  message: "You are not allowed to do this",
  error: true,
};

// Server actions are public endpoints: anyone who knows the action id can call them, whatever page they
// are rendered on. Every action here checks the session's role itself; the (admin) layout only guards the UI.
export const getUsersAction = async () => {
  if (!(await getIsAdmin())) {
    return [];
  }

  const users = await getManyUsers();
  return users;
};

export const toggleUserAccessAction = async (
  prevState: unknown,
  formData: FormData,
): Promise<ActionResult> => {
  if (!(await getIsAdmin())) {
    return NOT_ALLOWED;
  }

  try {
    const email = formData.get("email");

    if (!email) {
      return {
        message: "Email is required",
        error: true,
      };
    }

    await toggleUserAccessByEmail(email.toString());

    return {
      message: "User access was updated",
      error: false,
    };
  } catch (e) {
    console.error(e);

    return {
      message: "Something went wrong",
      error: true,
    };
  }
};

const isUserRole = (value: string): value is UserRole =>
  (Object.values(UserRole) as string[]).includes(value);

export const updateUserRoleAction = async (
  prevState: unknown,
  formData: FormData,
): Promise<ActionResult> => {
  if (!(await getIsAdmin())) {
    return NOT_ALLOWED;
  }

  const email = formData.get("email");
  const roleToUpdate = formData.get("roleToUpdate");

  if (!email || !roleToUpdate) {
    return {
      message: "User public id and role are required",
      error: true,
    };
  }

  const role = roleToUpdate.toString();

  if (!isUserRole(role)) {
    return {
      message: "Unknown role",
      error: true,
    };
  }

  try {
    await updateUserRoleByEmail(email.toString(), role);

    return {
      message: "User role was updated",
      error: false,
    };
  } catch (e) {
    console.error(e);

    return {
      message: "Something went wrong",
      error: true,
    };
  }
};
