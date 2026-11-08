import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/libs/auth/auth-utils", () => ({ getSession: vi.fn() }));
vi.mock("@/libs/stripe/stripe", () => ({ getStripe: vi.fn() }));

import { getSession } from "@/libs/auth/auth-utils";
import { getStripe } from "@/libs/stripe/stripe";
import { paymentsConfig } from "@/config/payments-config";
import {
  createCheckoutSession,
  createPaymentIntent,
  createPortalSession,
} from "./actions";

const sesionConCliente = {
  user: { email: "a@b.c", stripeCustomerId: "cus_1" },
};

const formulario = (campos: Record<string, string>) => {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(campos))
    datos.append(clave, valor);
  return datos;
};

const stripeFalso = () => ({
  checkout: {
    sessions: {
      create: vi
        .fn()
        .mockResolvedValue({ client_secret: null, url: "https://stripe/x" }),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn().mockResolvedValue({ url: "https://stripe/portal" }),
    },
  },
  paymentIntents: {
    create: vi.fn().mockResolvedValue({ client_secret: "pi_secret" }),
  },
});

describe("pricing actions", () => {
  let stripe: ReturnType<typeof stripeFalso>;
  const plan = paymentsConfig.pricingPlans[0];

  beforeEach(() => {
    stripe = stripeFalso();
    vi.mocked(getStripe).mockReturnValue(stripe as never);
    vi.mocked(getSession).mockReset();
    process.env.AUTH_URL = "https://xpand.example";
  });

  afterEach(() => {
    delete process.env.AUTH_URL;
  });

  describe("without a session", () => {
    beforeEach(() => {
      vi.mocked(getSession).mockResolvedValue(null);
    });

    it("createCheckoutSession refuses and never reaches Stripe", async () => {
      await expect(
        createCheckoutSession(
          formulario({ planId: String(plan.id), uiMode: "hosted" }),
        ),
      ).rejects.toThrow(/session/i);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("createPortalSession refuses and never reaches Stripe", async () => {
      await expect(createPortalSession()).rejects.toThrow(/session/i);
      expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it("createPaymentIntent refuses and never reaches Stripe", async () => {
      await expect(
        createPaymentIntent(formulario({ planId: String(plan.id) })),
      ).rejects.toThrow(/session/i);
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  describe("with a session", () => {
    beforeEach(() => {
      vi.mocked(getSession).mockResolvedValue(sesionConCliente as never);
    });

    it("createCheckoutSession prices the plan from the server config and ignores a tampered amount", async () => {
      await createCheckoutSession(
        formulario({
          planId: String(plan.id),
          uiMode: "hosted",
          amount: "0.01",
          planName: "Free",
        }),
      );

      const parametros = stripe.checkout.sessions.create.mock.calls[0]?.[0];
      expect(parametros.line_items[0].price_data.unit_amount).toBe(
        Math.round(plan.price * 100),
      );
      expect(parametros.line_items[0].price_data.product_data.name).toBe(
        plan.name,
      );
    });

    it("createCheckoutSession builds the return URLs from AUTH_URL", async () => {
      await createCheckoutSession(
        formulario({ planId: String(plan.id), uiMode: "hosted" }),
      );

      const parametros = stripe.checkout.sessions.create.mock.calls[0]?.[0];
      // The placeholder must reach Stripe literally (not percent-encoded) for it to substitute the session id.
      expect(parametros.success_url).toBe(
        "https://xpand.example/dashboard?session_id={CHECKOUT_SESSION_ID}",
      );
      expect(parametros.cancel_url).toBe("https://xpand.example/dashboard");
    });

    it("createCheckoutSession rejects an unknown plan or ui mode", async () => {
      await expect(
        createCheckoutSession(formulario({ planId: "999", uiMode: "hosted" })),
      ).rejects.toThrow(/plan/i);
      await expect(
        createCheckoutSession(
          formulario({ planId: String(plan.id), uiMode: "popup" }),
        ),
      ).rejects.toThrow(/ui mode/i);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("createPaymentIntent prices the plan from the server config", async () => {
      await createPaymentIntent(
        formulario({ planId: String(plan.id), amount: "0.01" }),
      );

      expect(stripe.paymentIntents.create.mock.calls[0]?.[0].amount).toBe(
        Math.round(plan.price * 100),
      );
    });

    it("without AUTH_URL the checkout is refused before reaching Stripe", async () => {
      delete process.env.AUTH_URL;
      await expect(
        createCheckoutSession(
          formulario({ planId: String(plan.id), uiMode: "hosted" }),
        ),
      ).rejects.toThrow(/AUTH_URL/);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });
});
