import "server-only";

import Stripe from "stripe";

/** Payments are on only when both Stripe keys are configured; otherwise nothing is ever sent to Stripe. */
export const pagosActivos = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY) &&
  Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

let cliente: Stripe | undefined;

/**
 * Stripe client, created on first use. Throws a clear error when payments are off, so a caller never reaches
 * Stripe without a key (the SDK would otherwise send the request and fail remotely).
 */
export const getStripe = (): Stripe => {
  if (!pagosActivos()) {
    throw new Error(
      "Payments are not enabled: STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are empty",
    );
  }

  cliente ??= new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    // https://github.com/stripe/stripe-node#configuration
    // More about api version: https://stripe.com/docs/api/versioning
    apiVersion: "2023-10-16",
    typescript: true,
  });

  return cliente;
};
