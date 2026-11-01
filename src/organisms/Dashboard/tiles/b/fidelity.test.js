import React from "react";
import { render, screen } from "@testing-library/react";
import ServiceContext from "../../../../ServiceContext";
import { owedFrom, owedHead } from "../../../AgentChat/owed";
import DashboardB from "../../../DashboardB/DashboardB";
import { forgetFloor } from "./floor";
import HeadTile from "./HeadTile";
import OwedTile from "./OwedTile";
import StandingTile from "./StandingTile";
import ReportsTile from "./ReportsTile";
import ProjectsTile from "./ProjectsTile";

// ─── FIDELITY: THE TILE AGAINST THE PAGE IT CAME OUT OF ────────────────────────────────────────
//
// His instruction when the lanes came back: *"render a second page instead of getting rid of this
// one so that I can check them against each other piece by piece."* Both exist at once, which
// makes the honest test available — not "the tile renders something plausible" but THE TILE'S DOM
// EQUALS THE PAGE'S SECTION, over the same documents, at the same instant.
//
// That is a far stronger claim than a screenshot comparison, and it fails loudly rather than
// being judged by eye. `.dbb-flow` matters most: it is the section he named as the version he
// likes, so it is the one that has to survive extraction untouched.
//
// THE HEAD IS THE DELIBERATE EXCEPTION and the test says exactly where. Its segment row is a
// filter now — broken out by obligation, pressable, narrowing every tile on the surface — and
// the original page's head is a sentence. Everything else in the head still has to match, so the
// title, the reach and the whole tide are compared and only `.dbb-head__say` is exempted.

const NOW = 1_700_000_000_000;
const DAY = 86400000;

// The page reads each document's file through `hostFiles`; the tile is handed the text. One
// fixture set, served both ways, is what makes the two comparable at all.
const mockTexts = {};
jest.mock("../../../../utils/hostFiles", () => ({
  hostFiles: (project) => ({
    readFile: async ({ path }) => ({ ok: true, content: mockTexts[`${project}::${path}`] }),
  }),
}));

const doc = (row, text) => {
  const full = { project: "p", at: NOW - DAY, ...row };
  mockTexts[`${full.project}::${full.path}`] = text;
  return { row: full, text };
};

const WAITING = doc(
  { id: "RFC-001", kind: "rfc", path: "RFCs/RFC-001-a-thing.md", state: { verdict: "approved" } },
  '::rfc{id=RFC-001}\n\n:::approval{ask="Approve the plan?"}\nx\n:::\n',
);
const BUILT = doc(
  { id: "RFC-002", kind: "rfc", path: "RFCs/RFC-002-another.md", state: { verdict: "approved", built: true } },
  [
    "::rfc{id=RFC-002}",
    "",
    ':::claim[the first thing happens]{id=c1 state=met by=you at=1 note="saw it"}',
    '::run{cmd="yarn test"}',
    ":::",
    '::claim[the second thing happens]{id=c2 state=unchecked}',
    "",
  ].join("\n"),
);
const ARC = doc(
  { id: "ARC-001", kind: "arc", path: "RFCs/arcs/ARC-001-the-work.md", state: { verdict: "approved" } },
  [
    '::arc{id=ARC-001 owner=p title="The work"}',
    "",
    ":::objective{id=O1 state=doing owner=you}",
    "one",
    ":::",
    ':::objective{id=O2 state=blocked owner=p because="the hub has no door for it"}',
    "two",
    ":::",
    "",
  ].join("\n"),
);
const GAP = doc({ id: "G-1", kind: "gap", path: "gaps/G-1-x.md", state: { hasProof: true } }, "::gap{id=G-1}\n");
// A REAL REPORT DECLARES ITS SUBTYPE — `as=` is what sets the retention the clock then runs on,
// and `Report.js` marks a leaf without one as invalid. The fixture declared none, which is not a
// report anybody would file.
const REPORT = (id, { project = "p", retain = "14d", openedAt, as = "account" } = {}) =>
  doc(
    { id, kind: "report", project, path: `.systemview/report.${project}.${id}.md`, openedAt, state: { retain, subtype: as } },
    `::report{id=${id} as=${as} retain=${retain}}\n\n# ${id}\n`,
  );

// One opened (its clock is running) and one never opened (its clock has not started) — the two
// states the card now has to tell apart.
const DOCS = [
  WAITING,
  BUILT,
  ARC,
  GAP,
  REPORT("r-one", { openedAt: NOW - 12 * DAY, as: "account" }),
  REPORT("r-two", { project: "q", as: "planning" }),
];
const ROOTS = { p: "/p", q: "/q", quietone: "/z" };

/** The shared value the surface hands a tile — `dashboardData.js`'s published shape. */
const data = () => {
  const owed = owedFrom({ docs: DOCS, now: NOW });
  return {
    read: true,
    error: "",
    docs: DOCS,
    allDocs: DOCS,
    roots: ROOTS,
    owed,
    allOwed: { ...owed, head: owedHead(owed) },
    beat: 0,
    open: () => ({ handled: true }),
    only: null,
    setOnly: () => {},
    filtering: false,
  };
};

/** The page, over the same documents, read the way it reads them. */
const mountPage = async () => {
  const { container } = render(
    <ServiceContext.Provider
      value={{
        SystemViewService: {
          Agent: { documentsRegistry: async () => DOCS.map((d) => d.row) },
          SystemView: { projectRoots: async () => ROOTS },
        },
      }}
    >
      <DashboardB />
    </ServiceContext.Provider>,
  );
  await screen.findByText("The floor");
  return container;
};

// The page is mounted ONCE and kept as markup: testing-library unmounts after every test, so a
// live reference would be an empty div by the time the first comparison ran.
let page;

// ONE INSTANT FOR BOTH. Every retention clock here is a function of `now`, so two derivations a
// millisecond apart could legitimately disagree and the comparison would be measuring the test
// harness rather than the extraction.
//
// ASSIGNED, NOT SPIED: this project's jest runs with `resetMocks`, which wipes a spy's return
// value between tests and would hand the second comparison a `now` of `undefined`.
const realNow = Date.now;
beforeAll(async () => {
  Date.now = () => NOW;
  const html = (await mountPage()).innerHTML;
  page = document.createElement("div");
  page.innerHTML = html;
});
afterAll(() => {
  Date.now = realNow;
});
beforeEach(() => {
  Date.now = () => NOW;
  forgetFloor();
});

/** The tile's section, rendered on its own out of the same data. */
const tileSection = (Component, selector) => {
  const { container } = render(<Component data={data()} />);
  return container.querySelector(selector);
};
const pageSection = (selector) => page.querySelector(selector);

// A tile stands inside its own `.dbb-ctx` wrapper; the page's section stands directly in `.dbb`.
// That wrapper is the whole reason the hues survive the move, and it is the one structural
// difference allowed — so the SECTION elements are compared, not their parents.
const same = (Component, selector) => {
  const mine = tileSection(Component, selector);
  const theirs = pageSection(selector);
  expect(theirs).toBeTruthy();
  expect(mine).toBeTruthy();
  expect(mine.outerHTML).toBe(theirs.outerHTML);
};

// ─── THE ONE HE NAMED ──────────────────────────────────────────────────────────────────────────

it("the standing tile is the page's .dbb-flow, element for element", () => {
  same(StandingTile, ".dbb-flow");
});

// ─── AND THE REST OF THE PAGE ──────────────────────────────────────────────────────────────────

it("the owed tile is the page's .dbb-needs, element for element", () => {
  same(OwedTile, ".dbb-needs");
});

// ─── THE REPORTS, WHERE THE DIFFERENCE IS ALSO THE POINT ───────────────────────────────────────
//
// The candidate pages are retired: `DashboardB` renders nowhere now and lives here as the frozen
// record of what the tile was extracted FROM. Holding a living tile to a frozen snapshot forever
// means every improvement has to be made twice in code nobody can see — which is the two-copies
// problem this file exists to prevent, enforced by a test. So the rule is the one the head
// already follows: everything the extraction carried over still has to match, and the one place
// it deliberately moved on is named here rather than quietly exempted.
//
// WHAT MOVED: his *"you should put what kind of report it is, it should be visible"*, and *"can't
// you tell if I've seen the report or not — once I see it, it starts expiring."* The page's card
// shows a ring, a title and a clock; a full ring on it means either "all its time left" or "never
// opened", and nothing distinguishes them.
describe("the reports tile matches the page except where it answers two questions the page could not", () => {
  const mine = () => tileSection(ReportsTile, ".dbb-stacks");

  it("the section, its head and the stack faces' own numbers are unchanged", () => {
    expect(mine().querySelector(".dbb-flow__head").outerHTML).toBe(
      pageSection(".dbb-stacks").querySelector(".dbb-flow__head").outerHTML,
    );
    const nums = (el) => [...el.querySelectorAll(".dbb-stack__n")].map((e) => e.textContent);
    expect(nums(mine())).toEqual(nums(pageSection(".dbb-stacks")));
  });

  it("every card now says what KIND of report it is, and the page's says nowhere", () => {
    expect(mine().querySelectorAll(".dbb-rcard__as").length).toBeGreaterThan(0);
    expect(pageSection(".dbb-stacks").querySelectorAll(".dbb-rcard__as")).toHaveLength(0);
  });

  // THE CLOCK DOES NOT START UNTIL HE OPENS IT, so "not counting" IS "not seen" — one field
  // answers both, and without it a full ring is unreadable.
  it("an unopened report says so, which is the only thing that explains its full ring", () => {
    const unopened = [...mine().querySelectorAll(".dbb-rcard")].filter((c) => c.querySelector(".dbb-rcard__unseen"));
    expect(unopened.length).toBeGreaterThan(0);
    expect(pageSection(".dbb-stacks").querySelectorAll(".dbb-rcard__unseen")).toHaveLength(0);
  });
});

it("the projects tile is the page's .dbb-projects, element for element", () => {
  same(ProjectsTile, ".dbb-projects");
});

// ─── THE HEAD, WHERE THE DIFFERENCE IS THE POINT ───────────────────────────────────────────────

describe("the head matches everywhere it was not deliberately changed", () => {
  const head = () => {
    const { container } = render(<HeadTile data={data()} />);
    return container;
  };

  it.each([".dbb-head__title", ".dbb-head__reach", ".dbb-tide__cap", ".dbb-tide", ".dbb-tide__legend"])(
    "%s is unchanged",
    (sel) => {
      expect(head().querySelector(sel).outerHTML).toBe(pageSection(sel).outerHTML);
    },
  );

  // THE SEGMENT ROW IS THE CHANGE, and it is his: *"of course I want to filter by obligations,
  // and add more obligations up there."* The page says one lump; the tile says what the work IS,
  // and every segment with something behind it is a control that narrows the whole surface.
  it("the segment row is the one thing that differs, and it differs by becoming a filter", () => {
    const mine = head().querySelector(".dbb-head__say");
    const theirs = pageSection(".dbb-head__say");
    expect(mine.outerHTML).not.toBe(theirs.outerHTML);
    expect(theirs.querySelectorAll("button")).toHaveLength(0);
    expect(mine.querySelectorAll("button").length).toBeGreaterThan(0);
    // the page's lump, broken out — and the sum is still the same obligations
    expect(theirs.textContent).toContain("outstanding");
    expect(mine.textContent).toContain("1 objective yours");
    expect(mine.textContent).toContain("1 blocked");
  });
});
