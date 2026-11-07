import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider, createClient } from "@xpand/api";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./styles.css";
import { restoreLocale } from "./i18n/locale";
import { createAppRouter } from "./routes";

// The schemas are checked against every response in development only (ajv is then loaded on demand).
const apiClient = createClient({ validate: import.meta.env.DEV });
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
