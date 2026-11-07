import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton";

describe("<Skeleton>", () => {
  it("is hidden from assistive technology", () => {
    render(<Skeleton />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it("takes a width and height as inline size", () => {
    render(<Skeleton width="12rem" height="1rem" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton.style.width).toBe("12rem");
    expect(skeleton.style.height).toBe("1rem");
  });

  it("merges extra classes", () => {
    render(<Skeleton className="mt-2" />);
    expect(screen.getByTestId("skeleton").className).toMatch(/mt-2/);
  });

  it("stops pulsing when the user prefers reduced motion", () => {
    render(<Skeleton />);
    const className = screen.getByTestId("skeleton").className;
    expect(className).toMatch(/animate-pulse/);
    expect(className).toMatch(/motion-reduce:animate-none/);
  });
});
