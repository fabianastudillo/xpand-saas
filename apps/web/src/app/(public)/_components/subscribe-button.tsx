"use client";

import Link from "next/link";

import { authConfig } from "@/config/auth-config";
import { useAuth } from "@/hooks/use-auth";
import { createCheckoutSession } from "@/app/(public)/pricing/actions";
import { Button } from "@/components/ui/button";

interface SubscribeButtonProps {
  /** Id of the plan in paymentsConfig; the server looks up name and price, the client never sends them. */
  planId: number;
  /** False while Stripe has no keys: the plan is shown but cannot be bought. */
  pagosActivos: boolean;
  children: React.ReactNode;
}

export const SubscribeButton = ({
  planId,
  pagosActivos,
  children,
}: SubscribeButtonProps) => {
  const { status } = useAuth();

  const handleCheckout = async () => {
    const formData = new FormData();
    formData.append("planId", String(planId));
    formData.append("uiMode", "hosted");

    const { url } = await createCheckoutSession(formData);

    window.location.assign(url as string);
  };

  const isUnauthenticated = status === "unauthenticated";
  const isLoading = status === "loading";

  if (!pagosActivos) {
    return (
      <Button
        variant="outline"
        disabled
        title="Payments are not enabled on this server"
      >
        Payments not enabled
      </Button>
    );
  }

  if (isLoading) {
    return <span className="loading loading-spinner loading-xs" />;
  }

  if (isUnauthenticated) {
    return (
      <Button asChild variant="outline">
        <Link href={authConfig.loginUrl}>Sign in to subscribe</Link>
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={() => handleCheckout()}>
      {children}
    </Button>
  );
};
