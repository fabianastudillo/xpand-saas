import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider } from "@xpand/api";
import { useState, type ReactElement, type ReactNode } from "react";
import { createAppClient } from "./app/apiClient";
import { IdeLayout } from "./app/IdeLayout";
import { restoreLocale } from "./i18n/locale";

// Applied when this chunk loads, before the first render: the zone only ever runs in the browser.
restoreLocale();

/**
 * The providers of the zone and its frame. Every response is checked against contracts/api, also in production
 * (see apiClient.ts). The client and the query cache are created once per visit.
 */
export function IdeRoot({ children }: { children: ReactNode }): ReactElement {
  const [apiClient] = useState(createAppClient);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={apiClient}>
        <IdeLayout>{children}</IdeLayout>
      </ApiProvider>
    </QueryClientProvider>
  );
}
