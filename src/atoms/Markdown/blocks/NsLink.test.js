import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import NsLink from "./NsLink";
import ServiceContext from "../../../ServiceContext";
import { MarkdownScopeProvider } from "../context";

// A NAMESPACE CHIP POINTS THE CODEBASE TREE AT SOMETHING — it does not drag the window to /specs.
// Same ruling as the report chip: *"they shouldn't be navigating me back to the code tab."*
//
// A namespace has no document, so there is no doc panel to open; the tree the bot carries is the
// only side-panel surface that draws one, and it answers by marking the reveal `handled`. Nothing
// answering is the honest case — then the chip still navigates, because a reference that visibly
// does nothing is the failure reveal-only already made once.
const revealed = [];
const locs = [];
const Watch = () => {
  locs.push(useLocation());
  return null;
};

const standingOn = (pathname) => window.history.replaceState({}, "", pathname);

const SERVICES = [
  {
    projectCode: "systemview-test",
    serviceId: "TestService",
    system: {
      connectionData: {
        modules: [{ name: "Math", methods: [{ fn: "add" }, { fn: "chainUse" }] }],
      },
    },
  },
];

const inScope = (ui, scope = {}) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <ServiceContext.Provider value={{ connectedServices: SERVICES }}>
        <MarkdownScopeProvider value={scope}>{ui}</MarkdownScopeProvider>
      </ServiceContext.Provider>
      <Watch />
    </MemoryRouter>,
  );

const SCOPE = { projectCode: "systemview-test", serviceId: "TestService" };

describe("a namespace chip points a panel instead of navigating", () => {
  let tree = null;
  const listener = (e) => {
    revealed.push(e.detail);
    if (tree) e.detail.handled = true;
  };
  beforeEach(() => {
    revealed.length = 0;
    locs.length = 0;
    tree = null;
    window.addEventListener("sv:revealInNav", listener);
  });
  afterEach(() => {
    window.removeEventListener("sv:revealInNav", listener);
    standingOn("/");
  });

  it("reveals into the panel and stays where it is", () => {
    tree = true;
    standingOn("/reports/systemview-test");
    inScope(<NsLink label="Math.add" />, SCOPE);
    fireEvent.click(screen.getByRole("button"));
    expect(revealed).toHaveLength(1);
    expect(revealed[0]).toMatchObject({
      kind: "namespace",
      projectCode: "systemview-test",
      serviceId: "TestService",
      moduleName: "Math",
      methodName: "add",
    });
    expect(locs[locs.length - 1].pathname).toBe("/");
  });

  it("still navigates when no tree is on screen to take it", () => {
    tree = false;
    standingOn("/agents/systemview-test");
    inScope(<NsLink label="Math.add" />, SCOPE);
    fireEvent.click(screen.getByRole("button"));
    expect(locs[locs.length - 1].pathname).toBe("/specs/systemview-test/TestService/Math/add");
  });

  it("navigates on the Code page without offering it to a panel first", () => {
    tree = true; // a panel would have taken it, and must not be asked
    standingOn("/specs/systemview-test");
    inScope(<NsLink label="Math.add" />, SCOPE);
    fireEvent.click(screen.getByRole("button"));
    expect(locs[locs.length - 1].pathname).toBe("/specs/systemview-test/TestService/Math/add");
    // the reveal still rides along with the navigation, exactly once
    expect(revealed).toHaveLength(1);
  });

  it("says so instead of doing anything when nothing answers to the name", () => {
    standingOn("/reports/systemview-test");
    inScope(<NsLink label="Nope.missing" />, SCOPE);
    expect(screen.queryByRole("button")).toBe(null);
    expect(screen.getByText("not connected")).toBeTruthy();
  });
});
