import { createContext, useContext } from "react";

export type BottomTab = "problems" | "log" | "output";

export interface ZoneState {
  /** Visible right now (a zone that was not given to the shell is never open). */
  open: boolean;
  /** The shell received content for this zone. */
  present: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  /** DOM id of the zone element, for aria-controls; it exists while hidden too. */
  id: string;
}

export interface ShellLayout {
  /** False outside an AppShell: every zone reads as open and the setters do nothing. */
  attached: boolean;
  /** Below the reflow breakpoint: side zones are overlay drawers. */
  narrow: boolean;
  left: ZoneState;
  right: ZoneState;
  bottom: ZoneState;
  /** The tab of the bottom panel, shared so the status bar can select «Problemas». */
  panelTab: BottomTab;
  setPanelTab: (tab: BottomTab) => void;
}

const noop = (): void => {};

const DETACHED_ZONE: ZoneState = { open: true, present: false, toggle: noop, setOpen: noop, id: "" };

export const DETACHED_LAYOUT: ShellLayout = {
  attached: false,
  narrow: false,
  left: DETACHED_ZONE,
  right: DETACHED_ZONE,
  bottom: DETACHED_ZONE,
  panelTab: "problems",
  setPanelTab: noop,
};

export const ShellLayoutContext = createContext<ShellLayout>(DETACHED_LAYOUT);

/** Open/collapsed state of the three collapsible zones and the bottom tab, with their setters. */
export function useShellLayout(): ShellLayout {
  return useContext(ShellLayoutContext);
}
