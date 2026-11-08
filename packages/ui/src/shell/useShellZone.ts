import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { firstFocusable, isTabStop, resolveTabStop } from "./focusable";
import { useZoneOpen, type ShellZone } from "./layoutStore";
import type { ZoneState } from "./shellLayoutContext";

export interface UseShellZoneOptions {
  zone: ShellZone;
  id: string;
  present: boolean;
  /** Below the reflow breakpoint the side zones are drawers: closed by default, never persisted. */
  narrow: boolean;
  /** Where the focus goes when the zone that held it is collapsed and nobody usable opened it. */
  mainRef: RefObject<HTMLElement | null>;
}

export interface ShellZoneHandle {
  state: ZoneState;
  ref: RefObject<HTMLElement | null>;
  drawer: boolean;
}

type PendingFocus = "enter" | "leave" | null;

/** An opener can take the focus back only while it is still reachable by Tab (connected, tabbable, not hidden). */
function isUsableOpener(opener: HTMLElement | null, zone: HTMLElement | null): opener is HTMLElement {
  return (
    opener !== null &&
    opener.isConnected &&
    isTabStop(opener) &&
    opener.closest("[hidden],[inert]") === null &&
    !(zone?.contains(opener) ?? false)
  );
}

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

  // Entering the narrow layout closes the drawers (the persisted desktop state is kept for later); if the
  // focus was inside, it leaves with the zone. Declared before the focus effect so the same commit sees it.
  useLayoutEffect(() => {
    if (!narrow || zone === "bottom") return;
    const element = ref.current;
    if (element?.contains(document.activeElement) === true) pending.current = "leave";
    setDrawerOpen(false);
  }, [narrow, zone]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next === open || !present) return;
      const element = ref.current;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const focusInside = element !== null && active !== null && element.contains(active);
      if (next) {
        // <body> is never an opener: restoring to it would drop the focus.
        if (!focusInside) opener.current = active !== null && active !== document.body ? active : null;
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

  // The pending action is consumed only once the open state matches it (a close may land a commit later).
  useLayoutEffect(() => {
    const action = pending.current;
    const element = ref.current;
    if (action === "enter" && open && element) {
      pending.current = null;
      // The remembered element must still be a tab stop: a tab that is no longer the active one (the status
      // bar selected «Problemas» meanwhile) has tabindex -1, and focusing it would activate it again.
      const remembered = lastInside.current;
      const stillThere = remembered?.isConnected === true && element.contains(remembered) && isTabStop(remembered);
      const target = stillThere ? resolveTabStop(remembered) : firstFocusable(element);
      (target ?? element).focus();
    } else if (action === "leave" && !open) {
      pending.current = null;
      const back = opener.current;
      opener.current = null; // one restore per opening
      (isUsableOpener(back, element) ? back : mainRef.current)?.focus();
    }
  }, [open, mainRef]);

  const state = useMemo<ZoneState>(
    () => ({ open, present, id, setOpen, toggle: () => { setOpen(!open); } }),
    [open, present, id, setOpen],
  );

  return { state, ref, drawer };
}
