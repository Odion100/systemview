// Ported from enzyme (2026-10-16). The original rendered into a div and asserted NOTHING — its
// title claimed the isSaved switch; now the test does.
import React from "react";
import { render } from "@testing-library/react";
import TestsIcon from "./TestsIcon";

describe("<TestsIcon/>", () => {
  it("shows the saved icon when isSaved, the missing icon otherwise", () => {
    const saved = render(<TestsIcon isSaved />);
    const missing = render(<TestsIcon />);
    const savedSrc = saved.container.querySelector("img.doc-icon__img").getAttribute("src");
    const missingSrc = missing.container.querySelector("img.doc-icon__img").getAttribute("src");
    expect(savedSrc).toContain("test-saved");
    expect(missingSrc).toContain("test-missing");
    expect(savedSrc).not.toBe(missingSrc);
  });

  it("carries a className through to the img", () => {
    const { container } = render(<TestsIcon className="mine" />);
    expect(container.querySelector("img.doc-icon__img").classList.contains("mine")).toBe(true);
  });
});
