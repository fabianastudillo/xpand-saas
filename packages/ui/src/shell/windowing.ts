import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Fixed-height windowing for long uniform lists (the SNI tree: 938 buses).
 *
 * Hand-rolled instead of @tanstack/react-virtual on purpose: rows are uniform, the scroll offset lives in
 * React state (so keyboard navigation can reveal a row deterministically, also in jsdom, where elements never
 * scroll), and it costs nothing in the bundle. If rows ever need variable heights, swap this for the library.
 */

export interface WindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  count: number;
  overscan: number;
}

export interface WindowRange {
  /** First rendered row (inclusive). */
  start: number;
  /** Last rendered row (exclusive). */
  end: number;
  /** Translation of the rendered block from the top of the list. */
  offsetTop: number;
  totalHeight: number;
}

export function computeWindow({ scrollTop, viewportHeight, rowHeight, count, overscan }: WindowInput): WindowRange {
  if (count === 0) return { start: 0, end: 0, offsetTop: 0, totalHeight: 0 };
  const firstVisible = Math.floor(scrollTop / rowHeight);
  // ceil: a row cut by the bottom edge is still visible and must be rendered.
  const lastVisible = Math.ceil((scrollTop + viewportHeight) / rowHeight);
  const start = Math.max(0, Math.min(firstVisible, count - 1) - overscan);
  const end = Math.min(count, lastVisible + overscan);
  return { start, end, offsetTop: start * rowHeight, totalHeight: count * rowHeight };
}

export interface RevealInput {
  index: number;
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
}

/** The smallest scroll change that makes row `index` fully visible. */
export function scrollTopToReveal({ index, scrollTop, viewportHeight, rowHeight }: RevealInput): number {
  const rowTop = index * rowHeight;
  const rowBottom = rowTop + rowHeight;
  if (rowTop < scrollTop) return rowTop;
  if (rowBottom > scrollTop + viewportHeight) return rowBottom - viewportHeight;
  return scrollTop;
}

export interface UseWindowedRowsOptions {
  count: number;
  /** Below this many rows everything is rendered; windowing only pays off for long lists. */
  threshold: number;
  /** Used until a row has been measured (the CSS token --row-h is 28px in normal density). */
  defaultRowHeight: number;
  /** Used until the viewport has been measured, and in environments without layout. */
  defaultViewportHeight: number;
  overscan: number;
}

export interface WindowedRows {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Attach to the first rendered row: its height is measured and watched (compact density is shorter). */
  measureRowRef: (element: HTMLElement | null) => void;
  range: WindowRange;
  rowHeight: number;
  windowed: boolean;
  onScroll: () => void;
  /** Scrolls so that the row is fully visible; the next render mounts it. */
  reveal: (index: number) => void;
}

function observeSize(element: Element, onChange: () => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  const observer = new ResizeObserver(onChange);
  observer.observe(element);
  return () => {
    observer.disconnect();
  };
}

export function useWindowedRows({
  count,
  threshold,
  defaultRowHeight,
  defaultViewportHeight,
  overscan,
}: UseWindowedRowsOptions): WindowedRows {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTopState] = useState(0);
  // Mirror of the state, so reveal() can compute from the latest offset without a side effect in an updater.
  const scrollTopRef = useRef(0);
  const setScrollTop = useCallback((next: number) => {
    scrollTopRef.current = next;
    setScrollTopState(next);
  }, []);
  const [rowHeight, setRowHeight] = useState(defaultRowHeight);
  const [viewportHeight, setViewportHeight] = useState(defaultViewportHeight);
  const windowed = count > threshold;

  // The first rendered row is measured when attached and whenever it resizes (density change).
  const stopRowObserver = useRef<() => void>(() => {});
  const measureRowRef = useCallback((element: HTMLElement | null) => {
    stopRowObserver.current();
    stopRowObserver.current = () => {};
    if (!element) return;
    const measure = (): void => {
      const measured = element.getBoundingClientRect().height;
      if (measured > 0) setRowHeight((current) => (current === measured ? current : measured));
    };
    measure();
    stopRowObserver.current = observeSize(element, measure);
  }, []);
  useEffect(
    () => () => {
      stopRowObserver.current();
    },
    [],
  );

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !windowed) return;
    const apply = (): void => {
      if (element.clientHeight > 0) setViewportHeight(element.clientHeight);
    };
    apply();
    return observeSize(element, apply);
  }, [windowed]);

  // When the list shrinks under the current offset, pull the offset back into range.
  useEffect(() => {
    const maxTop = Math.max(0, count * rowHeight - viewportHeight);
    if (scrollTop > maxTop) setScrollTop(maxTop);
  }, [count, rowHeight, viewportHeight, scrollTop, setScrollTop]);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element) setScrollTop(element.scrollTop);
  }, [setScrollTop]);

  const reveal = useCallback(
    (index: number) => {
      if (!windowed) return;
      const current = scrollTopRef.current;
      const next = scrollTopToReveal({ index, scrollTop: current, viewportHeight, rowHeight });
      if (next === current) return;
      if (scrollRef.current) scrollRef.current.scrollTop = next;
      setScrollTop(next);
    },
    [windowed, viewportHeight, rowHeight, setScrollTop],
  );

  const range = windowed
    ? computeWindow({ scrollTop, viewportHeight, rowHeight, count, overscan })
    : { start: 0, end: count, offsetTop: 0, totalHeight: count * rowHeight };

  return { scrollRef, measureRowRef, range, rowHeight, windowed, onScroll, reveal };
}
