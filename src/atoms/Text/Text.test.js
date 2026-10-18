// Ported from enzyme (2026-10-16) — claims unchanged.
import React from "react";
import { render } from "@testing-library/react";
import Text from "./Text";

describe("<Text/>", () => {
  it("renders a span tag with class text", () => {
    const { container } = render(<Text />);
    expect(container.querySelectorAll("span.text")).toHaveLength(1);
  });

  it("uses the text prop as the span's text", () => {
    const { container } = render(<Text text="test" />);
    expect(container.querySelector("span.text").textContent).toBe("test");
  });
});
