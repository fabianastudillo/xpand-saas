// Only routes that exist: the template also linked /features and /contact, which have no page (404 and, in
// production, prefetches from the navbar that never settle).
export const publicNavLinks = [
  {
    // The IDE zone ("Explorar casos"): its own document and stylesheet, open to visitors.
    title: "Explore cases",
    url: "/casos",
  },
  {
    title: "Pricing",
    url: "/pricing",
  },
];

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
