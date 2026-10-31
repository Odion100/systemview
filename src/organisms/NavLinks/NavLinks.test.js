import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NavLinks from "./NavLinks";

const at = (url, props) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <NavLinks {...props} />
    </MemoryRouter>,
  );
const href = (label) => screen.getByText(label).getAttribute("href");

describe("NavLinks — a section's memory is an address inside that section", () => {
  beforeEach(() => localStorage.clear());

  it("remembers where you were in a section, so the link returns you there", () => {
    at("/specs/sv?tab=stats", { projectCode: "sv", current: "specs" });
    expect(localStorage.getItem("sv.lastPath.specs")).toBe("/specs/sv?tab=stats");
  });

  it("REFUSES to record a location the section does not own — the nav of a page that is not on screen", () => {
    // The Code nav rendering while the agents page is the one showing: without this guard it
    // records the agents url as where you were in Code.
    at("/agents/sv", { projectCode: "sv", current: "specs" });
    expect(localStorage.getItem("sv.lastPath.specs")).toBeNull();
  });

  it("DROPS a remembered address from the wrong section instead of linking at it — a dead Code button is the bug", () => {
    localStorage.setItem("sv.lastPath.specs", "/agents/sv?scope=system");
    at("/agents/sv", { projectCode: "sv", current: "context" });
    expect(href("Code")).toBe("/specs/sv");
    expect(localStorage.getItem("sv.lastPath.specs")).toBeNull();
  });

  it("the Code link never points at the page you are already standing on", () => {
    localStorage.setItem("sv.lastPath.specs", "/agents/sv");
    at("/agents/sv", { projectCode: "sv", current: "context" });
    expect(href("Code")).not.toBe(href("Agents"));
  });

  it("counts /agents as the Agents section's own — one section can answer at two paths", () => {
    at("/agents/sv?agent=x", { projectCode: "sv", current: "context" });
    expect(localStorage.getItem("sv.lastPath.context")).toBe("/agents/sv?agent=x");
  });

  it("a kept address is honoured when it does belong — the whole point of remembering", () => {
    localStorage.setItem("sv.lastPath.specs", "/specs/sv/Svc/Mod/method?tab=code");
    at("/agents/sv", { projectCode: "sv", current: "context" });
    expect(href("Code")).toBe("/specs/sv/Svc/Mod/method?tab=code");
  });

  it("falls back to the section default with no memory at all", () => {
    at("/agents/sv", { projectCode: "sv", current: "context" });
    expect(href("Code")).toBe("/specs/sv");
  });

  it("does not mistake a prefix for a section — /specsomething is not /specs", () => {
    localStorage.setItem("sv.lastPath.specs", "/specsomething/sv");
    at("/agents/sv", { projectCode: "sv", current: "context" });
    expect(href("Code")).toBe("/specs/sv");
  });
});
