import { redirect } from "next/navigation";

import { getIsAuth } from "@/libs/auth/auth-utils";
import { authConfig } from "@/config/auth-config";
import { PublicNavbar } from "@/components/navbar/public-navbar";
import {
  pricingNavLink,
  publicNavLinks,
} from "@/config/navigation-links-config";
import { pagosActivos } from "@/libs/stripe/stripe";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuth = await getIsAuth();

  if (isAuth) {
    redirect(authConfig.normalUserCallbackUrl);
  }

  return (
    <div>
      <PublicNavbar
        links={
          pagosActivos() ? [...publicNavLinks, pricingNavLink] : publicNavLinks
        }
      />
      <main className="container">{children}</main>
    </div>
  );
}
