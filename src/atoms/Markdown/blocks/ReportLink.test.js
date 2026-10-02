import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import ReportLink from "./ReportLink";
import { MarkdownScopeProvider } from "../context";

// A REPORT CHIP OPENS A PANEL, IT DOES NOT MOVE THE WINDOW. His words: *"reports and namespaces
// should not — and this is not just the links panel, in general — they should be using the side
// panel, they shouldn't be navigating me back to the code tab."* Clicking one from Stats or Agents
// used to push /specs/<pc>?tab=reports&rdoc=… and take the page he was reading with it.
//
// Same shape as FileLink.test.js: assert the EVENT the chip dispatches and the location it did or
// did not push, not a rendered tree.
const seen = [];
const locs = [];
const Watch = () => {
  locs.push(useLocation());
  return null;
};

// The chip reads window.location to answer "am I on the Code page?" — the router's memory history
// is a different thing, and it is the one that records a navigation.
const standingOn = (pathname) => window.history.replaceState({}, "", pathname);

const inScope = (ui, scope = {}) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <MarkdownScopeProvider value={scope}>{ui}</MarkdownScopeProvider>
      <Watch />
    </MemoryRouter>,
  );

const PATH = ".systemview/report.systemview.the-links-panel.md";

describe("a report chip opens the side panel instead of navigating", () => {
  let panel = null;
  const listener = (e) => {
    seen.push(e.detail);
    if (panel) e.detail.handled = true;
  };
  beforeEach(() => {
    seen.length = 0;
    locs.length = 0;
    panel = null;
    window.addEventListener("sv:openFileInNav", listener);
  });
  afterEach(() => {
    window.removeEventListener("sv:openFileInNav", listener);
    standingOn("/");
  });

  it("hands the report to the panel and stays where it is", () => {
    panel = true;
    standingOn("/reports/systemview");
    inScope(<ReportLink label={PATH} />);
    fireEvent.click(screen.getByRole("link"));
    expect(seen).toHaveLength(1);
    expect(seen[0].path).toBe(PATH);
    // The project comes off the filename, so a chip can point across projects.
    expect(seen[0].projectCode).toBe("systemview");
    // A report is markdown — the panel must not have to guess from the extension.
    expect(seen[0].language).toBe("markdown");
    // …and nothing moved.
    expect(locs[locs.length - 1].pathname).toBe("/");
  });

  it("falls back to the Stage tab when no panel answers", () => {
    panel = false; // a page with no DocPanel — /agents, RFC-055
    standingOn("/agents/systemview");
    inScope(<ReportLink label={PATH} />);
    fireEvent.click(screen.getByRole("link"));
    expect(seen).toHaveLength(1); // it offered…
    const last = locs[locs.length - 1];
    expect(last.pathname).toBe("/specs/systemview"); // …and nobody took it
    expect(last.search).toContain("tab=reports");
    expect(last.search).toContain(encodeURIComponent(PATH));
  });

  it("navigates on the Code page without offering it to anything", () => {
    panel = true; // even with a panel listening
    standingOn("/specs/systemview");
    inScope(<ReportLink label={PATH} />);
    fireEvent.click(screen.getByRole("link"));
    expect(seen).toHaveLength(0);
    expect(locs[locs.length - 1].pathname).toBe("/specs/systemview");
  });

  it("carries the named project over the document's when one is given", () => {
    panel = true;
    standingOn("/reports/BUApp");
    inScope(<ReportLink label="notes/whatever.md" attrs={{ project: "buAPI" }} />, {
      projectCode: "BUApp",
    });
    fireEvent.click(screen.getByRole("link"));
    expect(seen[0].projectCode).toBe("buAPI");
  });
});
