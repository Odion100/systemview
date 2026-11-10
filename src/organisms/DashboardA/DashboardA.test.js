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
import { render, screen, within, fireEvent } from "@testing-library/react";
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

it("folds a project with nothing registered behind a count, and still says WHY it is empty when opened", async () => {
  mount([], { gamma: "/repos/gamma" });
  // FOLDED, NOT DROPPED. The count is the statement — he reads it without opening anything.
  const fold = await screen.findByRole("button", { name: /1 project with nothing in them/i });
  expect(fold).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("gamma")).not.toBeInTheDocument();
  // and the sentence is still in there, in the words it always had
  fireEvent.click(fold);
  expect(screen.getByText("gamma")).toBeInTheDocument();
  expect(screen.getByText(/no document in this project carries a leaf/i)).toBeInTheDocument();
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

// ─── THE LEGEND IS ALSO THE FILTER ─────────────────────────────────────────────────────────────
//
// His ask: *"you should be able to click that and filter everything below, which is multiple
// projects."* So these are about the WIRE — the pure fold is held to its answers next door; what
// only a mount can show is that a press reaches every lane at once and that the page says what it
// is holding instead of quietly showing him less.
const twoProjects = () => {
  mockFiles["RFCs/RFC-080-moving.md"] = "# RFC-080 — the one being built\n\n::rfc{id=RFC-080}\n";
  mockFiles["gaps/g-20.md"] = "# G-20 — a thing beta lacks\n\n::gap{id=G-20}\n";
  return mount(
    [
      { id: "RFC-080", kind: "rfc", path: "RFCs/RFC-080-moving.md", project: "alpha", at: NOW, state: { verdict: "approved", built: true, parsed: NOW } },
      { id: "G-20", kind: "gap", path: "gaps/g-20.md", project: "beta", at: NOW, state: { parsed: NOW } },
    ],
    { alpha: "/repos/alpha", beta: "/repos/beta" },
  );
};

it("holds a column from the axis and narrows every lane at once, more than one at a time", async () => {
  twoProjects();
  expect(await screen.findByText("alpha")).toBeInTheDocument();
  expect(screen.getByText("beta")).toBeInTheDocument();

  // HOLD `moving` — alpha's RFC is moving, beta's gap is proposed, so beta's lane goes
  const moving = screen.getByRole("button", { name: /moving/ });
  fireEvent.click(moving);
  expect(moving).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("alpha")).toBeInTheDocument();
  expect(screen.queryByText("beta")).not.toBeInTheDocument();
  // and the page says what it is holding rather than quietly showing him less
  expect(screen.getByText(/holding moving/)).toBeInTheDocument();

  // HOLD `proposed` AS WELL — both lanes are back, which is the whole reason it is not a radio
  fireEvent.click(screen.getByRole("button", { name: /proposed/ }));
  expect(screen.getByText("alpha")).toBeInTheDocument();
  expect(screen.getByText("beta")).toBeInTheDocument();
  expect(screen.getByText(/holding moving \+ proposed/)).toBeInTheDocument();

  // AND PRESSING IT AGAIN LETS GO. There is no `all` to find: nothing held is everything.
  fireEvent.click(moving);
  fireEvent.click(screen.getByRole("button", { name: /proposed/ }));
  expect(screen.queryByText(/holding/)).not.toBeInTheDocument();
  expect(screen.getByText("alpha")).toBeInTheDocument();
  expect(screen.getByText("beta")).toBeInTheDocument();
});

it("says a filter matched nothing in the filter's own words, never as a claim about the machine", async () => {
  twoProjects();
  await screen.findByText("alpha");
  fireEvent.click(screen.getByRole("button", { name: /set down/ }));
  expect(screen.getByText(/nothing is setdown in any project right now/i)).toBeInTheDocument();
  // the registry was read and is not empty — the page may not say otherwise
  expect(screen.queryByText(/registry is empty/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/no projects/i)).not.toBeInTheDocument();
});

// ─── THE KINDS IN A LANE ARE ITS FILTERS ───────────────────────────────────────────────────────
//
// *"Instead of hide the numbers and show the numbers, there should be filters for that separate
// section of the type of documents that are there."* So the show-hide is gone, and what opens the
// list is a word that also says which kind it opens.
it("opens the numbers filtered to the kind pressed, and closes when the last one is let go", async () => {
  mockFiles["RFCs/RFC-081-a.md"] = "# RFC-081 — a design\n\n::rfc{id=RFC-081}\n";
  mockFiles["gaps/g-21.md"] = "# G-21 — a thing missing\n\n::gap{id=G-21}\n";
  mount(
    [
      { id: "RFC-081", kind: "rfc", path: "RFCs/RFC-081-a.md", project: "alpha", at: NOW, state: { verdict: "approved", built: true, parsed: NOW } },
      { id: "G-21", kind: "gap", path: "gaps/g-21.md", project: "alpha", at: NOW, state: { parsed: NOW } },
    ],
    { alpha: "/repos/alpha" },
  );
  await screen.findByText("alpha");
  // THE SHOW-HIDE IS GONE, in both of its words
  expect(screen.queryByText("the numbers")).not.toBeInTheDocument();
  expect(screen.queryByText("hide the numbers")).not.toBeInTheDocument();

  const lane = screen.getByText("alpha").closest(".dba-lane");
  const picks = lane.querySelector(".dba-lane__picks");
  const rfc = within(picks).getByRole("button", { name: /1 RFC/ });
  const gap = within(picks).getByRole("button", { name: /1 gap/ });

  // nothing held — no list at all
  expect(lane.querySelector(".dba-list")).toBeNull();

  fireEvent.click(rfc);
  expect(rfc).toHaveAttribute("aria-pressed", "true");
  const list = () => lane.querySelector(".dba-list");
  expect(within(list()).getByText("RFC-081")).toBeInTheDocument();
  expect(within(list()).queryByText("G-21")).not.toBeInTheDocument();

  // MORE THAN ONE AT A TIME
  fireEvent.click(gap);
  expect(within(list()).getByText("RFC-081")).toBeInTheDocument();
  expect(within(list()).getByText("G-21")).toBeInTheDocument();

  // and letting go of the last one closes it — the words are the show-hide
  fireEvent.click(rfc);
  fireEvent.click(gap);
  expect(lane.querySelector(".dba-list")).toBeNull();
});

it("keeps each lane's kinds its own — holding alpha's gaps does not open beta's", async () => {
  mockFiles["gaps/g-30.md"] = "# G-30 — alpha's\n\n::gap{id=G-30}\n";
  mockFiles["gaps/g-31.md"] = "# G-31 — beta's\n\n::gap{id=G-31}\n";
  mount(
    [
      { id: "G-30", kind: "gap", path: "gaps/g-30.md", project: "alpha", at: NOW, state: { parsed: NOW } },
      { id: "G-31", kind: "gap", path: "gaps/g-31.md", project: "beta", at: NOW, state: { parsed: NOW } },
    ],
    { alpha: "/repos/alpha", beta: "/repos/beta" },
  );
  await screen.findByText("alpha");
  const alpha = screen.getByText("alpha").closest(".dba-lane");
  const beta = screen.getByText("beta").closest(".dba-lane");
  fireEvent.click(within(alpha.querySelector(".dba-lane__picks")).getByRole("button", { name: /1 gap/ }));
  expect(alpha.querySelector(".dba-list")).not.toBeNull();
  expect(beta.querySelector(".dba-list")).toBeNull();
});

// ─── A MARK IS A FILTER, NOT A DOOR ────────────────────────────────────────────────────────────
//
// *"Clicking them shouldn't take you to the document. I don't like that. I like clicking them kind
// of filtering the list below to only show that one that is referring to."* So the one event this
// page was allowed to emit is now emitted by the ROWS, and a mark emits nothing at all.
it("narrows the lane to one document when its mark is pressed, and opens nothing", async () => {
  mockFiles["RFCs/RFC-090-one.md"] = "# RFC-090 — the first\n\n::rfc{id=RFC-090}\n";
  mockFiles["RFCs/RFC-091-two.md"] = "# RFC-091 — the second\n\n::rfc{id=RFC-091}\n";
  mount(
    [
      { id: "RFC-090", kind: "rfc", path: "RFCs/RFC-090-one.md", project: "alpha", at: NOW, state: { verdict: "approved", built: true, parsed: NOW } },
      { id: "RFC-091", kind: "rfc", path: "RFCs/RFC-091-two.md", project: "alpha", at: NOW, state: { verdict: "approved", built: true, parsed: NOW } },
    ],
    { alpha: "/repos/alpha" },
  );
  await screen.findByText("alpha");
  const opened = [];
  const listen = (e) => opened.push(e.detail);
  window.addEventListener("sv:openFileInNav", listen);

  const lane = screen.getByText("alpha").closest(".dba-lane");
  const mark = within(lane).getByRole("button", { name: /^RFC-090 —/ });
  fireEvent.click(mark);

  // IT OPENED NOTHING — that is the whole of the complaint
  expect(opened).toHaveLength(0);
  expect(mark).toHaveAttribute("aria-pressed", "true");
  // and the list below is narrowed to that one document, not to its kind
  const list = () => lane.querySelector(".dba-list");
  expect(within(list()).getByText("RFC-090")).toBeInTheDocument();
  expect(within(list()).queryByText("RFC-091")).not.toBeInTheDocument();

  // THE ROW IS STILL THE DOOR. The mark narrows; the row it reveals opens.
  within(list()).getByText("RFC-090").closest("button").click();
  expect(opened).toHaveLength(1);
  expect(opened[0]).toMatchObject({ projectCode: "alpha", path: "RFCs/RFC-090-one.md" });
  window.removeEventListener("sv:openFileInNav", listen);

  // pressing the same mark again lets go
  fireEvent.click(mark);
  expect(mark).toHaveAttribute("aria-pressed", "false");
  expect(lane.querySelector(".dba-list")).toBeNull();
});

it("lets a kind word take over from a pinned mark rather than intersecting with it", async () => {
  mockFiles["RFCs/RFC-092.md"] = "# RFC-092 — a design\n\n::rfc{id=RFC-092}\n";
  mockFiles["gaps/g-40.md"] = "# G-40 — a thing missing\n\n::gap{id=G-40}\n";
  mount(
    [
      { id: "RFC-092", kind: "rfc", path: "RFCs/RFC-092.md", project: "alpha", at: NOW, state: { verdict: "approved", built: true, parsed: NOW } },
      { id: "G-40", kind: "gap", path: "gaps/g-40.md", project: "alpha", at: NOW, state: { parsed: NOW } },
    ],
    { alpha: "/repos/alpha" },
  );
  await screen.findByText("alpha");
  const lane = screen.getByText("alpha").closest(".dba-lane");
  fireEvent.click(within(lane).getByRole("button", { name: /^RFC-092 —/ }));
  const list = () => lane.querySelector(".dba-list");
  expect(within(list()).getByText("RFC-092")).toBeInTheDocument();

  // ASK FOR THE GAPS and the pin lets go — an intersection could only answer with nothing
  fireEvent.click(within(lane.querySelector(".dba-lane__picks")).getByRole("button", { name: /1 gap/ }));
  expect(within(list()).getByText("G-40")).toBeInTheDocument();
  expect(within(list()).queryByText("RFC-092")).not.toBeInTheDocument();
  expect(within(lane).getByRole("button", { name: /^RFC-092 —/ })).toHaveAttribute("aria-pressed", "false");
});
