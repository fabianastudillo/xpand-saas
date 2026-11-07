import { describe, expect, it } from "vitest";
import { computeWindow, scrollTopToReveal } from "./windowing";

const ROW = 28;

describe("computeWindow", () => {
  it("covers the visible rows plus the overscan on both sides", () => {
    const range = computeWindow({ scrollTop: 280, viewportHeight: 280, rowHeight: ROW, count: 938, overscan: 4 });
    // Rows 10..19 are visible (10 rows of 28px); overscan adds 4 on each side.
    expect(range.start).toBe(6);
    expect(range.end).toBe(24);
    expect(range.offsetTop).toBe(6 * ROW);
    expect(range.totalHeight).toBe(938 * ROW);
  });

  it("clamps to the list bounds", () => {
    const top = computeWindow({ scrollTop: 0, viewportHeight: 100, rowHeight: ROW, count: 50, overscan: 4 });
    expect(top.start).toBe(0);
    const bottom = computeWindow({ scrollTop: 10_000, viewportHeight: 100, rowHeight: ROW, count: 50, overscan: 4 });
    expect(bottom.end).toBe(50);
    expect(bottom.start).toBeLessThan(50);
  });

  it("renders everything when the list is empty or shorter than the viewport", () => {
    expect(computeWindow({ scrollTop: 0, viewportHeight: 300, rowHeight: ROW, count: 0, overscan: 2 })).toEqual({
      start: 0,
      end: 0,
      offsetTop: 0,
      totalHeight: 0,
    });
    const small = computeWindow({ scrollTop: 0, viewportHeight: 300, rowHeight: ROW, count: 5, overscan: 2 });
    expect(small).toMatchObject({ start: 0, end: 5 });
  });
});

describe("scrollTopToReveal", () => {
  it("keeps the current scroll when the row is already fully visible", () => {
    expect(scrollTopToReveal({ index: 12, scrollTop: 280, viewportHeight: 280, rowHeight: ROW })).toBe(280);
  });

  it("scrolls up to a row above the viewport and down to one below it", () => {
    expect(scrollTopToReveal({ index: 3, scrollTop: 280, viewportHeight: 280, rowHeight: ROW })).toBe(3 * ROW);
    expect(scrollTopToReveal({ index: 30, scrollTop: 280, viewportHeight: 280, rowHeight: ROW })).toBe(31 * ROW - 280);
  });
});
