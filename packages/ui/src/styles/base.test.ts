import { describe, expect, it } from "vitest";
import base from "./base.css?raw";

describe("base.css", () => {
  it("hides the skip link until it is focused, then shows it on the accent", () => {
    expect(base).toMatch(/\.xp-skip-link:not\(:focus\)/);
    expect(base).toMatch(/\.xp-skip-link:focus\s*\{[^}]*position:\s*fixed/);
    expect(base).toMatch(/\.xp-skip-link:focus\s*\{[^}]*background:\s*var\(--accent\)/);
  });

  it("keeps selection, highlight and the active tab visible under forced colors", () => {
    const block = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n {2}\}/.exec(base)?.[1] ?? "";
    expect(block).toMatch(/\[role="treeitem"\]\[aria-selected="true"\]/);
    expect(block).toMatch(/\[role="option"\]\[aria-selected="true"\]/);
    expect(block).toMatch(/Highlight/);
    expect(block).toMatch(/\[data-slot="tabs-trigger"\]\[data-state="active"\]/);
  });
});
