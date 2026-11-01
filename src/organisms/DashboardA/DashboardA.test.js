// THE WIRE, MOUNTED. This component turns out to be jest-mountable — nothing in its import graph
// reaches react-markdown — so the two things a pure module cannot answer are answered here, and
// they are both about HONESTY rather than layout:
//
//   1. A page nobody could read must never draw as a clear page. "You are owed nothing" and "no
//      answer came back" look identical if the surface is careless, and that is the one failure
//      this dashboard may not have.
//   2. It opens documents and presses nothing. The only event it is allowed to emit is the one
//      opener every file address in this window already rides.
import React from "react";
import { render, screen, within } from "@testing-library/react";
import ServiceContext from "../../ServiceContext";
import DashboardA from "./DashboardA";

// THE FILES ARE THE SHELL'S, so they are the one thing stubbed. `mock`-prefixed, because
// babel-plugin-jest-hoist lifts the factory above every other declaration in the file and will
// refuse any other name it cannot prove is safe to touch up there.
var mockFiles = {};
jest.mock("../../utils/hostFiles", () => ({
  hostFiles: () => ({ readFile: async ({ path }) => ({ path, content: mockFiles[path] || "" }) }),
}));

const NOW = Date.now();
const mount = (rows, roots, extra = {}) =>
  render(
    <ServiceContext.Provider
      value={{
        SystemViewService: {
          Agent: { documentsRegistry: async () => rows },
          SystemView: { projectRoots: () => roots },
          ...extra,
        },
      }}
    >
      <DashboardA />
    </ServiceContext.Provider>,
  );

beforeEach(() => {
  mockFiles = {};
});

it("says the registry is empty rather than drawing a clear page", async () => {
  mount([], { alpha: "/repos/alpha" });
  expect(await screen.findByText(/registry is empty/i)).toBeInTheDocument();
  // and the gauge must not claim he is clear over a registry nothing was read from
  expect(screen.queryByText(/nothing owed/i)).not.toBeInTheDocument();
});

it("says the registry could not be READ, which is not the same sentence as empty", async () => {
  render(
    <ServiceContext.Provider
      value={{ SystemViewService: { Agent: { documentsRegistry: async () => { throw new Error("the hub is not connected yet"); } } } }}
    >
      <DashboardA />
    </ServiceContext.Provider>,
  );
  expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();
  expect(screen.getAllByText("not measured").length).toBe(2);
});

it("draws a lane for a project with nothing registered and says WHY it is empty", async () => {
  mount([], { gamma: "/repos/gamma" });
  expect(await screen.findByText("gamma")).toBeInTheDocument();
  expect(screen.getByText(/nothing registered/i)).toBeInTheDocument();
});

it("puts what needs him at the top, in owed.js's own words, and opens the document on a press", async () => {
  mockFiles["RFCs/RFC-071-a-design.md"] = [
    "# RFC-071 — the read path",
    "",
    "::rfc{id=RFC-071 title=\"the read path\"}",
    "",
    ":::approval{ask=\"ship the read path?\"}",
    "sign it",
    ":::",
  ].join("\n");
  const opened = [];
  window.addEventListener("sv:openFileInNav", (e) => opened.push(e.detail));
  mount(
    [{ id: "RFC-071", kind: "rfc", path: "RFCs/RFC-071-a-design.md", project: "alpha", at: NOW, state: { verdict: "approved", parsed: NOW } }],
    { alpha: "/repos/alpha" },
  );
  await screen.findByText("ship the read path?");
  expect(screen.getByText(/1 approval waiting/)).toBeInTheDocument();
  screen.getByRole("button", { name: /ship the read path\?/ }).click();
  expect(opened).toHaveLength(1);
  expect(opened[0]).toMatchObject({ projectCode: "alpha", path: "RFCs/RFC-071-a-design.md", language: "markdown" });
});

it("stacks the reports with a number and never shows a clock it was not given", async () => {
  mockFiles["meetings/kept.md"] = "# A meeting that is kept\n\n::report{id=kept retain=permanent}\n";
  mockFiles["meetings/unread.md"] = "# A meeting nobody opened\n\n::report{id=unread retain=7d}\n";
  mount(
    [
      { id: "kept", kind: "report", path: "meetings/kept.md", project: "alpha", at: NOW, state: { retain: "permanent", subtype: "planning", parsed: NOW } },
      { id: "unread", kind: "report", path: "meetings/unread.md", project: "alpha", at: NOW, state: { retain: "7d", subtype: "planning", parsed: NOW } },
    ],
    { alpha: "/repos/alpha" },
  );
  // the stack is a PILE WITH A NUMBER — his words — and the number is the pile's own
  const pile = await screen.findByRole("button", { name: /2 reports/ });
  expect(within(pile).getByText("2")).toBeInTheDocument();
  expect(screen.getByText(/retires 7 days after first read/)).toBeInTheDocument();
  expect(screen.getByText("permanent")).toBeInTheDocument();
  // the pile's face never invents a deadline: one permanent report and one whose clock has not
  // started, so there is nothing to count down and it says what is there to read instead
  expect(within(pile).getByText("1 to read")).toBeInTheDocument();
});

it("renders without a hub at all rather than throwing — an older one simply has no rows", async () => {
  expect(() =>
    render(
      <ServiceContext.Provider value={{ SystemViewService: {} }}>
        <DashboardA />
      </ServiceContext.Provider>,
    ),
  ).not.toThrow();
  expect(await screen.findByText(/reading the registry/i)).toBeInTheDocument();
});

// ONE DOCUMENT IS ONE ROW. His complaint, and it is about focus rather than tidiness: an arc with
// three blocked objectives is one place to go and work on, and three rows of it push the NEXT
// document off the surface he opened this page to read.
it("folds one document's obligations into one row that opens into them", async () => {
  mockFiles["RFCs/arcs/ARC-001-the-body.md"] = [
    "# ARC-001 — the body of work",
    "",
    "::arc{id=ARC-001 title=\"the body of work\"}",
    "",
    // An objective is a CONTAINER — three colons, wrapping the prose a person reads. Two is a
    // leaf and parses as nothing, which is how this fixture failed the first time.
    ":::objective{id=O1 title=\"the first\" state=blocked blocked=\"the hub has no verb for it\"}",
    "the first thing",
    ":::",
    ":::objective{id=O2 title=\"the second\" state=blocked blocked=\"waiting on the rewrite\"}",
    "the second thing",
    ":::",
    ":::objective{id=O3 title=\"the third\" owner=you state=inProgress}",
    "the third thing",
    ":::",
    "",
    ":::approval{ask=\"approve the body of work?\"}",
    "sign it",
    ":::",
  ].join("\n");
  mount(
    [{ id: "ARC-001", kind: "arc", path: "RFCs/arcs/ARC-001-the-body.md", project: "alpha", at: NOW, state: { verdict: "approved", parsed: NOW } }],
    { alpha: "/repos/alpha" },
  );
  // THE FACE CARRIES THE STRONGEST ONE AND THE COUNT OF THE REST — not a bare "4 outstanding",
  // which would make him open the row to find out whether any of it mattered. Strongest here is
  // the objective that is HIS, because that is what `owedFrom` ranked first; the two blocked ones
  // and the no-plan line are behind the fold. Four obligations, one document, one row.
  const face = await screen.findByRole("button", { name: /yours, and open/ });
  expect(within(face).getByText("+3 more")).toBeInTheDocument();
  // Closed, the rest are NOT IN THE OWED LIST. Scoped to that section on purpose: the same
  // sentences also live on the lane's hover card further down the page, which is a different
  // surface with a different job, and an unscoped query would pass whatever this fold did.
  const list = face.closest(".dba__owed");
  expect(within(list).queryByText(/waiting on the rewrite/)).not.toBeInTheDocument();
  expect(face).toHaveAttribute("aria-expanded", "false");

  face.click();
  expect(await within(list).findByText(/waiting on the rewrite/)).toBeInTheDocument();
  expect(within(list).getByText(/the hub has no verb for it/)).toBeInTheDocument();
  expect(within(list).getByText(/3 objectives with no plan attached/)).toBeInTheDocument();

  // A CHILD OPENS THE DOCUMENT AT ITS OWN LINE — the fold is navigation, not a tooltip.
  const opened = [];
  const listen = (e) => opened.push(e.detail);
  window.addEventListener("sv:openFileInNav", listen);
  within(list).getByText(/waiting on the rewrite/).closest("button").click();
  window.removeEventListener("sv:openFileInNav", listen);
  expect(opened).toHaveLength(1);
  // `openAddress` carries a RANGE, not a line — the one door every file address in this
  // window rides. O2 opens at its own block, which is line 8 of the fixture.
  expect(opened[0]).toMatchObject({ projectCode: "alpha", path: "RFCs/arcs/ARC-001-the-body.md", lines: [8, 8] });
});
