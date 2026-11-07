/** Candidates for the tab order; tabindex="-1" members are filtered out afterwards. */
const CANDIDATES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]",
].join(",");

/** Is the element itself a tab stop (reachable with Tab, not only programmatically)? */
export function isTabStop(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.tabIndex >= 0 && !element.hasAttribute("disabled");
}

/**
 * In a tablist the tab stop is the selected tab (APG). Radix only moves its roving tabindex on focus, so a
 * tab selected from outside (the status bar picking «Problemas») is not yet the tab stop: redirect to it,
 * otherwise focusing the stale tab would activate it again.
 */
export function resolveTabStop(element: HTMLElement): HTMLElement {
  if (element.getAttribute("role") !== "tab" || element.getAttribute("aria-selected") === "true") return element;
  const selected = element.closest('[role="tablist"]')?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  return selected ?? element;
}

/** The first tab stop inside `root`, in DOM order. */
export function firstFocusable(root: ParentNode): HTMLElement | null {
  for (const candidate of root.querySelectorAll(CANDIDATES)) {
    if (isTabStop(candidate)) return resolveTabStop(candidate);
  }
  return null;
}

export function hasFocusable(root: ParentNode): boolean {
  return firstFocusable(root) !== null;
}
