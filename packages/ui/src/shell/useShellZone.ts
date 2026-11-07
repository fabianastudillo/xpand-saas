import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { firstFocusable, isTabStop, resolveTabStop } from "./focusable";
import { useZoneOpen, type ShellZone } from "./layoutStore";
import type { ZoneState } from "./shellLayoutContext";

export interface UseShellZoneOptions {
  zone: ShellZone;
  id: string;
  present: boolean;
  /** Below the reflow breakpoint the side zones are drawers: closed by default, never persisted. */
  narrow: boolean;
  /** Where the focus goes when the zone that held it is collapsed and nobody opened it. */
  mainRef: RefObject<HTMLElement | null>;
}

export interface ShellZoneHandle {
  state: ZoneState;
  ref: RefObject<HTMLElement | null>;
  drawer: boolean;
}

type PendingFocus = "enter" | "leave" | null;

/**
 * One collapsible zone: persisted open state (desktop), drawer state (narrow) and focus management.
 * Closing a zone that holds the focus moves it to the control that opened the zone, or to <main>;
 * opening it puts the focus back on the element that last had it there, or on its first tab stop.
 */
export function useShellZone({ zone, id, present, narrow, mainRef }: UseShellZoneOptions): ShellZoneHandle {
  const ref = useRef<HTMLElement | null>(null);
  const drawer = zone !== "bottom" && narrow;
  const [storedOpen, setStoredOpen] = useZoneOpen(zone, true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const open = present && (drawer ? drawerOpen : storedOpen);

  const pending = useRef<PendingFocus>(null);
  const opener = useRef<HTMLElement | null>(null);
  const lastInside = useRef<HTMLElement | null>(null);

  // Entering the narrow layout closes the drawers; leaving it restores the persisted desktop state.
  useEffect(() => {
    if (narrow) setDrawerOpen(false);
  }, [narrow]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next === open || !present) return;
      const element = ref.current;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const focusInside = element !== null && active !== null && element.contains(active);
      if (next) {
        if (!focusInside) opener.current = active;
        pending.current = "enter";
      } else if (focusInside) {
        lastInside.current = active;
        pending.current = "leave";
      }
      if (drawer) setDrawerOpen(next);
      else setStoredOpen(next);
    },
    [open, present, drawer, setStoredOpen],
  );

  useLayoutEffect(() => {
    const action = pending.current;
    pending.current = null;
    const element = ref.current;
    if (action === "enter" && open && element) {
      // The remembered element must still be a tab stop: a tab that is no longer the active one (the status
      // bar selected «Problemas» meanwhile) has tabindex -1, and focusing it would activate it again.
      const remembered = lastInside.current;
      const stillThere = remembered?.isConnected === true && element.contains(remembered) && isTabStop(remembered);
      const target = stillThere ? resolveTabStop(remembered) : firstFocusable(element);
      (target ?? element).focus();
    } else if (action === "leave" && !open) {
      const back = opener.current;
      const target = back?.isConnected && !(element?.contains(back) ?? false) ? back : mainRef.current;
      target?.focus();
    }
  }, [open, mainRef]);

  const state = useMemo<ZoneState>(
    () => ({ open, present, id, setOpen, toggle: () => { setOpen(!open); } }),
    [open, present, id, setOpen],
  );

  return { state, ref, drawer };
}
