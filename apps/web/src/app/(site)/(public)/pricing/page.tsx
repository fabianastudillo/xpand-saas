import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Pricing } from "../_components/pricing";

import { paymentsConfig } from "@/config/payments-config";
import { pagosActivos } from "@/libs/stripe/stripe";
import { Typography } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: paymentsConfig.title,
  description: paymentsConfig.description,
};

// Prices exist only while payments are on (ruling R20): without the Stripe keys this route is a 404, like any
// other address with no page, and nothing links to it.
export default function PricingPage() {
  if (!pagosActivos()) notFound();

  return (
    <section className="py-16">
      <Typography component="h1" className="text-center">
        Pricing
      </Typography>
      <Pricing />
    </section>
  );
}
