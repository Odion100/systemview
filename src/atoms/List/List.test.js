// Ported from enzyme (2026-10-16) — claims unchanged.
import React from "react";
import { render } from "@testing-library/react";
import List from "./List";

describe("<List/>", () => {
  it("renders a div tag with class list", () => {
    const { container } = render(<List />);
    expect(container.querySelectorAll("div.list")).toHaveLength(1);
  });

  it("renders its children inside the list", () => {
    const { container } = render(
      <List>
        <div className="test"></div>
      </List>
    );
    expect(container.querySelectorAll("div.list > div.test")).toHaveLength(1);
  });
});
