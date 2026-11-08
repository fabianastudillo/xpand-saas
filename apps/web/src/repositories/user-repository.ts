import prisma from "@/libs/prisma";

import { UserRole } from "@prisma/client";

interface User {
  email: string;
  name: string;
  isActive?: boolean;
  emailVerified?: Date | null;
  image?: string;
  role: UserRole;
}

export const getUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const getUserByUid = async (uid: string) => {
  return prisma.user.findUnique({
    where: { id: uid },
  });
};

export const createOrUpdateUser = async ({
  email,
  name,
  role,
  isActive = false,
  emailVerified,
  image,
}: User) => {
  return prisma.user.upsert({
    where: { email: email },
    update: {},
    create: {
      email,
      name,
      isActive,
      emailVerified,
      image,
      role,
    },
  });
};

/**
 * First administrator: creates the user with the ADMIN role or promotes the existing one. The e-mail is lower-cased
 * because Auth.js normalises the one it receives; an upper-case address would never match the session's.
 */
export const createOrPromoteAdmin = async ({ email, name }: { email: string; name: string }) => {
  const normalized = email.trim().toLowerCase();
  return prisma.user.upsert({
    where: { email: normalized },
    update: { role: UserRole.ADMIN },
    create: { email: normalized, name, isActive: false, role: UserRole.ADMIN },
  });
};

export const getManyUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      isActive: true,
      role: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const toggleUserAccessByEmail = async (email: string) => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("User not found");
  }

  return prisma.user.update({
    where: { email },
    data: { isActive: !user.isActive },
  });
};

export const updateUserRoleByEmail = async (email: string, role: UserRole) => {
  try {
    return prisma.user.update({
      where: { email },
      data: {
        role: role,
      },
    });
  } catch (error) {
    console.error(error);
    throw new Error("Failed to update user role", { cause: error });
  }
};

export const updateStripeCustomerIdByEmail = async (
  email: string,
  stripeCustomerId: string,
) => {
  return prisma.user.update({
    where: { email },
    data: {
      stripeCustomerId,
    },
  });
};

export const activeUserByStripeCustomerId = async (
  stripeCustomerId: string,
) => {
  return prisma.user.update({
    where: {
      stripeCustomerId: stripeCustomerId,
    },
    data: {
      isActive: true,
    },
  });
};

export const desactiveUserByStripeCustomerId = async (
  stripeCustomerId: string,
) => {
  return prisma.user.update({
    where: {
      stripeCustomerId: stripeCustomerId,
    },
    data: {
      isActive: false,
    },
  });
};
