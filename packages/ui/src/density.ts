/** Density modes defined in tokens.css. Compact tightens rows and controls for large tables. */
export type Density = "normal" | "compact";

/** Attribute that tokens.css reads; set it on the element whose subtree should change density. */
export const DENSITY_ATTRIBUTE = "data-density";

/** Applies a density to an element. `normal` removes the attribute so the :root tokens apply. */
export function applyDensity(element: HTMLElement, density: Density): void {
  if (density === "normal") {
    element.removeAttribute(DENSITY_ATTRIBUTE);
    return;
  }
  element.setAttribute(DENSITY_ATTRIBUTE, density);
}
