import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { CasePage } from "./features/explorar/CasePage";
import { CatalogPage } from "./features/explorar/CatalogPage";

/** The screens of M0. Every route is read-only: the app never writes to the server. */
export const ROUTE_TABLE: RouteObject[] = [
  { path: "/", element: <CatalogPage /> },
  { path: "/casos/:motor/:sistema", element: <CasePage /> },
  { path: "*", element: <Navigate to="/" replace /> },
];

/** The app is served under /app/ (Vite's base): the router takes that prefix off the paths it matches. */
export function createAppRouter() {
  return createBrowserRouter(ROUTE_TABLE, { basename: import.meta.env.BASE_URL.replace(/\/$/, "") });
}
