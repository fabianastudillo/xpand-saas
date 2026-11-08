import { useCallback, useSyncExternalStore } from "react";

function canQuery(): boolean {
  return typeof matchMedia === "function";
}

/** True while the media query matches; false where matchMedia does not exist (jsdom, server). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canQuery()) return () => {};
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  const read = useCallback(() => canQuery() && matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, read, () => false);
}
