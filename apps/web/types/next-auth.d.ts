// Docs: https://authjs.dev/getting-started/typescript
import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

export type ExtendedUser = DefaultSession["user"] & {
  publicId: string;
  role: UserRole;
  isActive: boolean;
  stripeCustomerId: string | null;
};

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: ExtendedUser;
  }
}
