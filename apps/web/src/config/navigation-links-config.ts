// Only routes that exist: the template also linked /features and /contact, which have no page (404 and, in
// production, prefetches from the navbar that never settle).
export const publicNavLinks = [
  {
    // The IDE zone ("Explorar casos"): its own document and stylesheet, open to visitors.
    title: "Explorar casos",
    url: "/casos",
  },
];

/** Only while payments are on: without them /pricing is a 404 and nothing links to it (ruling R20). */
export const pricingNavLink = {
  title: "Pricing",
  url: "/pricing",
};

export const adminNavLinks = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
  },
  {
    title: "User Management",
    url: "/admin/dashboard/user-management",
  },
  {
    title: "Feature Flags",
    url: "/admin/dashboard/feature-flags",
  },
];

export const authenticatedUserNavLinks = [
  {
    title: "Dashboard",
    url: "/dashboard",
  },
];
