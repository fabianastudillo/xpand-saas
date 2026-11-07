/** Vitest setup for the jsdom environment. Not exported from the package. */
import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Components identify their root with data-slot (as shadcn does); tests query it as the test id.
configure({ testIdAttribute: "data-slot" });

// Radix Popper measures its anchor through ResizeObserver, which jsdom does not implement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub;
}

afterEach(() => {
  cleanup();
});
