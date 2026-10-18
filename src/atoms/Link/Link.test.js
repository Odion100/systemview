// Ported from enzyme (2026-10-16). The atom changed under the dead suite: it is a react-router
// <Link> now, so it renders inside a router here. Two old claims died with the change and are
// recorded rather than faked: add_class is accepted but never rendered (dead prop), and the
// bare-anchor shape is gone.
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import Link from "./Link";

const mount = (ui, at = "/") => {
  let loc = null;
  const r = render(
    <MemoryRouter initialEntries={[at]}>
      {ui}
      <Route path="*" render={({ location }) => ((loc = location), null)} />
    </MemoryRouter>
  );
  return { ...r, loc: () => loc };
};

describe("<Link/>", () => {
  it("renders an anchor with class link carrying the text", () => {
    const { container } = mount(<Link link="/test" text="test" />);
    const a = container.querySelector("a.link");
    expect(a).not.toBeNull();
    expect(a.textContent).toBe("test");
    expect(a.getAttribute("href")).toBe("/test");
  });

  it("carries the current ?tab= along", () => {
    const { container } = mount(<Link link="/specs/pc" text="t" />, "/somewhere?tab=logs");
    expect(container.querySelector("a.link").getAttribute("href")).toBe("/specs/pc?tab=logs");
  });

  it("clicking while already active deselects to /specs", () => {
    const { container, loc } = mount(<Link link="/here" text="t" />, "/here");
    fireEvent.click(container.querySelector("a.link"));
    expect(loc().pathname).toBe("/specs");
  });
});
