import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { AppLayout } from "./app/AppLayout";
import { RouteError } from "./app/RouteError";
import { CasePage } from "./features/explorar/CasePage";
import { CatalogPage } from "./features/explorar/CatalogPage";

/**
 * The screens of M0 under one layout route: the shell persists while the pages change. Every route is read-only: the
 * app never writes to the server.
 */
export const ROUTE_TABLE: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <CatalogPage /> },
      { path: "casos/:motor/:sistema", element: <CasePage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

/** Vite's base is "/" (the XPAND server serves the app at the root): the router takes that empty prefix off the paths. */
export function createAppRouter() {
  return createBrowserRouter(ROUTE_TABLE, { basename: import.meta.env.BASE_URL.replace(/\/$/, "") });
}
