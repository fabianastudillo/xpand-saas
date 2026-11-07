import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { providers } from "@/libs/auth/providers/auth-providers";
import prisma from "@/libs/prisma";
import {
  getUserByEmail,
  updateStripeCustomerIdByEmail,
} from "@/repositories/user-repository";
import { getStripe, pagosActivos } from "@/libs/stripe/stripe";
import { decidirConfianzaHost } from "@/libs/auth/host-confianza";

const confianzaHost = decidirConfianzaHost(process.env);

if (confianzaHost.error) {
  // Not thrown: `next build` also runs with NODE_ENV=production and must work without runtime secrets.
  // With trustHost false every sign-in fails with UntrustedHost, and scripts/arranque.mjs refuses to start
  // the production server without AUTH_URL.
  console.error(confianzaHost.error);
}

export const {
  handlers: { GET, POST },
  auth,
} = NextAuth({
  // Host header trusted only with AUTH_URL set (then it is not used) or outside production: see host-confianza.ts.
  trustHost: confianzaHost.trustHost,
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session }) {
      if (!session.user.email) {
        throw new Error("Missing email");
      }

      const userData = await getUserByEmail(session.user.email);

      if (session.user && userData) {
        session.user.role = userData.role;
        session.user.isActive = userData.isActive;
        session.user.stripeCustomerId = userData.stripeCustomerId;
      }

      return session;
    },
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }

      if (token.email) {
        const userData = await getUserByEmail(token.email);
        token.isActive = userData?.isActive;
        token.role = userData?.role;
      }

      return token;
    },
  },
  events: {
    createUser: async ({ user }) => {
      try {
        if (!user.email) {
          console.warn("events:createUser: No email found", {
            user: user.email,
          });
          return;
        }

        if (!pagosActivos()) {
          // Payments are off (no Stripe keys): no customer is created and nothing is sent to Stripe.
          return;
        }

        const customer = await getStripe().customers.create({
          email: user.email!,
        });

        await updateStripeCustomerIdByEmail(user.email, customer.id);

        console.log("events:createUser - Stripe customer created", {
          user: user.email,
        });
      } catch (e) {
        console.error("events:createUser", e);
      }
    },
  },
  debug: false,
});
