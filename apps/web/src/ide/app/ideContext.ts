import type { UseQueryResult } from "@tanstack/react-query";
import type { ApiFailure, Red } from "@xpand/api";
import { createContext, useContext } from "react";

/** What the layout hands to the page of the route: the network of the case in the address. */
export interface CaseContextValue {
  red: UseQueryResult<Red, ApiFailure>;
}

export const CaseContext = createContext<CaseContextValue | null>(null);

export function useCaseContext(): CaseContextValue {
  const value = useContext(CaseContext);
  if (value === null) throw new Error("The case page needs the IDE layout above it.");
  return value;
}

/** What the layout offers to the pages to steer the navigation. */
export interface IdeNavigationValue {
  /**
   * Called when the user opens a case from the catalog: the case page then gives the keyboard focus to its tree.
   * Next has no navigation state as React Router did, so the layout remembers which case was opened that way.
   */
  arriveFromCatalog: (engineId: string, systemId: string) => void;
}

export const IdeNavigationContext = createContext<IdeNavigationValue | null>(null);

export function useIdeNavigation(): IdeNavigationValue {
  const value = useContext(IdeNavigationContext);
  if (value === null) throw new Error("The catalog page needs the IDE layout above it.");
  return value;
}
