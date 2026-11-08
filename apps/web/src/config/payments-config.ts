// Example plans of the template: they are shown only while payments are on (pagosActivos(), /pricing is a 404
// otherwise). Before turning payments on, replace them with the real plans and Stripe price ids (TODO.md).
export const paymentsConfig = {
  title: "Planes",
  description: "Planes de pago de XPAND.",
  defaultCurrency: "USD",
  pricingPlans: [
    {
      id: 1,
      name: "Basic",
      price: 9.99,
      priceId: "your_price_id",
      features: ["Feature 1", "Feature 2", "Feature 3"],
      cta: "Start Basic",
    },
    {
      id: 2,
      name: "Pro",
      price: 29.99,
      priceId: "your_price_id",
      features: [
        "Feature 1",
        "Feature 2",
        "Feature 3",
        "Feature 4",
        "Feature 5",
      ],
      cta: "Start Pro",
    },
    {
      id: 3,
      name: "Teams",
      price: 59.99,
      priceId: "your_price_id",
      features: ["All Pro features", "Additional Feature 6", "24/7 Support"],
      cta: "Start Teams",
    },
  ],
};
