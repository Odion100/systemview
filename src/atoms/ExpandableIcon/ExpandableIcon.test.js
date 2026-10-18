// Ported from enzyme (2026-10-16) — the class claim kept, plus the contract the atom actually
// carries: the open/closed glyph, the click, the color/size styles.
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import ExpandableIcon from "./ExpandableIcon";

describe("<ExpandableIcon/>", () => {
  it("renders an element with class expandable-icon", () => {
    const { container } = render(<ExpandableIcon />);
    expect(container.querySelectorAll(".expandable-icon")).toHaveLength(1);
  });

  it("shows ▾ open and ▸ closed, and clicks through", () => {
    const onClick = jest.fn();
    const open = render(<ExpandableIcon isOpen onClick={onClick} />);
    expect(open.container.querySelector(".expandable-icon").textContent).toBe("▾");
    fireEvent.click(open.container.querySelector(".expandable-icon"));
    expect(onClick).toHaveBeenCalled();
    const closed = render(<ExpandableIcon />);
    expect(closed.container.querySelector(".expandable-icon").textContent).toBe("▸");
  });

  it("applies color and size as inline style", () => {
    const { container } = render(<ExpandableIcon color="#123456" size="14px" />);
    const el = container.querySelector(".expandable-icon");
    expect(el.style.fontSize).toBe("14px");
    expect(el.style.color).toBeTruthy();
  });
});
