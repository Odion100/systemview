// Ported from enzyme (2026-10-16). The second original test was a copy-paste that re-asserted the
// first; it now asserts what its title always meant to — the text renders.
import React from "react";
import { render } from "@testing-library/react";
import DescriptionText from "./DescriptionText";

describe("<DescriptionText/>", () => {
  it("renders a p with class description-text__text inside div.description-text", () => {
    const { container } = render(<DescriptionText />);
    expect(container.querySelectorAll("div.description-text")).toHaveLength(1);
    expect(container.querySelectorAll("p.description-text__text")).toHaveLength(1);
  });

  it("renders the text prop", () => {
    const { container } = render(<DescriptionText text="test" />);
    expect(container.querySelector("p.description-text__text").textContent).toBe("test");
  });
});
