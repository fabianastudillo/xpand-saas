import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider } from "@xpand/api";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./styles.css";
import { createAppClient } from "./app/apiClient";
import { restoreLocale } from "./i18n/locale";
import { createAppRouter } from "./routes";

// Every response is checked against contracts/api, also in production (see apiClient.ts).
const apiClient = createAppClient();
const queryClient = new QueryClient();
const router = createAppRouter();

restoreLocale();

const container = document.getElementById("root");
if (container === null) throw new Error("Missing the #root element in index.html.");

createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <ApiProvider client={apiClient}>
      <RouterProvider router={router} />
    </ApiProvider>
  </QueryClientProvider>,
);
