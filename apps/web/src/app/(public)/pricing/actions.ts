"use server";

import type { Stripe } from "stripe";

import { paymentsConfig } from "@/config/payments-config";
import { formatAmountForStripe } from "@/libs/stripe/stripe-helpers";
import { getStripe } from "@/libs/stripe/stripe";
import { getSession } from "@/libs/auth/auth-utils";

// Server actions are public endpoints. Nothing that decides what is charged comes from the client: the plan is
// looked up by id in the server config, the price is the config's, and the return URLs come from AUTH_URL
// (never from the Origin header). Every action requires a session with a Stripe customer.

interface ReturnData {
  client_secret: string | null;
  url: string | null;
}

type Plan = (typeof paymentsConfig.pricingPlans)[number];

type UiMode = Stripe.Checkout.SessionCreateParams.UiMode;

const UI_MODES: readonly UiMode[] = ["hosted", "embedded"];

const isUiMode = (value: unknown): value is UiMode =>
  UI_MODES.some((mode) => mode === value);

const requireCustomerSession = async () => {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("No session found");
  }

  if (!session.user.stripeCustomerId) {
    throw new Error("No stripeCustomerId found");
  }

  return session.user.stripeCustomerId;
};

const planFromForm = (data: FormData): Plan => {
  const planId = Number(data.get("planId"));
  const plan = paymentsConfig.pricingPlans.find(
    (candidate) => candidate.id === planId,
  );

  if (!plan) {
    throw new Error("Unknown plan");
  }

  return plan;
};

const uiModeFromForm = (data: FormData): UiMode => {
  const uiMode = data.get("uiMode");

  if (!isUiMode(uiMode)) {
    throw new Error("Unknown ui mode");
  }

  return uiMode;
};

/** Absolute URL of a path of this app, from AUTH_URL (the public URL), never from request headers. */
const appUrl = (path: string): string => {
  const base = process.env.AUTH_URL?.trim();

  if (!base) {
    throw new Error("AUTH_URL is required to build the payment return URLs");
  }

  return new URL(path, base).toString();
};

const unitAmount = (plan: Plan): number =>
  formatAmountForStripe(plan.price, paymentsConfig.defaultCurrency);

export async function createCheckoutSession(
  data: FormData,
): Promise<ReturnData> {
  const customer = await requireCustomerSession();
  const plan = planFromForm(data);
  const ui_mode = uiModeFromForm(data);

  const checkoutSession: Stripe.Checkout.Session =
    await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: paymentsConfig.defaultCurrency,
            product_data: {
              name: plan.name,
            },
            recurring: {
              interval: "month",
            },
            unit_amount: unitAmount(plan),
          },
        },
      ],
      ...(ui_mode === "hosted" && {
        success_url: appUrl("/dashboard?session_id={CHECKOUT_SESSION_ID}"),
        cancel_url: appUrl("/dashboard"),
      }),
      ...(ui_mode === "embedded" && {
        return_url: appUrl(
          "/dashboard/result?session_id={CHECKOUT_SESSION_ID}",
        ),
      }),
      ui_mode,
    });

  return {
    client_secret: checkoutSession.client_secret,
    url: checkoutSession.url,
  };
}

export async function createPortalSession() {
  const customer = await requireCustomerSession();

  const portalSession: Stripe.BillingPortal.Session =
    await getStripe().billingPortal.sessions.create({
      customer,
      return_url: appUrl("/dashboard"),
    });

  return { url: portalSession.url };
}

export async function createPaymentIntent(
  data: FormData,
): Promise<{ client_secret: string }> {
  const customer = await requireCustomerSession();
  const plan = planFromForm(data);

  const paymentIntent: Stripe.PaymentIntent =
    await getStripe().paymentIntents.create({
      amount: unitAmount(plan),
      customer,
      automatic_payment_methods: { enabled: true },
      currency: paymentsConfig.defaultCurrency,
    });

  return { client_secret: paymentIntent.client_secret as string };
}
