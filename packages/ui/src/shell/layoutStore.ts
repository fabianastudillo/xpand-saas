import { useCallback, useState } from "react";

export type ShellZone = "left" | "right" | "bottom";

const STORAGE_PREFIX = "xpand.shell.";

/** Even the accessor can throw (private windows, blocked storage); the shell must still render. */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readZoneOpen(zone: ShellZone, fallback: boolean): boolean {
  try {
    const raw = storage()?.getItem(STORAGE_PREFIX + zone);
    if (raw === "open") return true;
    if (raw === "collapsed") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeZoneOpen(zone: ShellZone, open: boolean): void {
  try {
    storage()?.setItem(STORAGE_PREFIX + zone, open ? "open" : "collapsed");
  } catch {
    // Persistence is a convenience; losing it must not break the layout.
  }
}

/** Open/collapsed state of a zone, read from localStorage on mount and written on every change. */
export function useZoneOpen(zone: ShellZone, defaultOpen: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(() => readZoneOpen(zone, defaultOpen));
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      writeZoneOpen(zone, next);
    },
    [zone],
  );
  return [open, setOpen];
}
