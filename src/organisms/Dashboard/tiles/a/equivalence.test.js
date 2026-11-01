// ─── THE TILE IS THE SECTION — PROVED AGAINST THE PAGE, NOT AGAINST A SCREENSHOT ───────────────
//
// His instruction when the lanes came back: *"render a second page instead of getting rid of this
// one so that I can check them against each other piece by piece."* The original `DashboardA`
// stays, rendering its sections inline; these tiles are a second copy of the same markup. That
// duplication is deliberate and temporary — and while it lasts it buys the strongest fidelity
// check available, far better than the eye:
//
//   MOUNT BOTH OVER THE SAME ROWS AND COMPARE THE DOM, NODE FOR NODE.
//
// His standing complaint about this surface is *"I do not want to come here and see that it's
// off."* An `outerHTML` equality is the only assertion that cannot be satisfied by a tile that is
// nearly right. One attribute moved, one class dropped, one `<span>` that became a `<div>` — all
// of it fails here, loudly, with the diff printed.
//
// NOTHING IS ALLOWED TO DIFFER. Every section is held to `outerHTML` equality against the one the
// page draws from the same rows.
import React from "react";
import { render, screen, within } from "@testing-library/react";
import ServiceContext from "../../../../ServiceContext";
import DashboardA from "../../../DashboardA/DashboardA";
import { HeadTileA, OwedTileA, StandingTileA } from "./index";

var mockFiles = {};
jest.mock("../../../../utils/hostFiles", () => ({
  hostFiles: () => ({ readFile: async ({ path }) => ({ path, content: mockFiles[path] || "" }) }),
}));

const NOW = Date.now();
const ROOTS = { alpha: "/repos/alpha", beta: "/repos/beta", gamma: "/repos/gamma" };

// ONE FIXTURE WITH EVERY SHAPE THE PAGE DRAWS, because an equivalence test over a thin fixture
// proves the tile copies the easy half. An approval waiting, an arc with a blocked objective and
// one that is his, an RFC with claims, a report with a clock, a report that is permanent, a row
// whose file is gone, a proof fixture, and a project with nothing in it at all.
const FILES = {
  "RFCs/RFC-071-read-path.md": [
    "# RFC-071 — the read path",
    "",
    '::rfc{id=RFC-071 title="the read path"}',
    "",
    ':::approval{ask="ship the read path?"}',
    "sign it",
    ":::",
  ].join("\n"),
  "RFCs/RFC-072-the-claims.md": [
    "# RFC-072 — the claims",
    "",
    '::rfc{id=RFC-072 title="the claims" state=approved}',
    "",
    ":::claim{id=C1}",
    "nobody has checked this",
    ":::",
    ":::claim{id=C2 met=true}",
    "this one is met with no proof",
    ":::",
  ].join("\n"),
  "RFCs/arcs/ARC-001-the-body.md": [
    "# ARC-001 — the body of work",
    "",
    '::arc{id=ARC-001 title="the body of work"}',
    "",
    ':::objective{id=O1 title="the first" state=blocked blocked="waiting on the rewrite"}',
    "the first thing",
    ":::",
    ':::objective{id=O2 title="the second" owner=you state=inProgress}',
    "the second thing",
    ":::",
  ].join("\n"),
  "RFCs/gaps/GAP-003-the-lack.md": ["# GAP-003 — the lack", "", '::gap{id=GAP-003 title="the lack"}'].join("\n"),
  "meetings/kept.md": "# A meeting that is kept\n\n::report{id=kept retain=permanent}\n",
  "meetings/unread.md": "# A meeting nobody opened\n\n::report{id=unread retain=7d}\n",
  "RFCs/proofs/mock-rfc.md": [
    "# MOCK — a proof fixture",
    "",
    '::rfc{id=MOCK-RFC title="a fixture wearing a document" fixture=true}',
  ].join("\n"),
};

const ROWS = [
  { id: "RFC-071", kind: "rfc", path: "RFCs/RFC-071-read-path.md", project: "alpha", at: NOW, state: { verdict: "approved", parsed: NOW } },
  { id: "RFC-072", kind: "rfc", path: "RFCs/RFC-072-the-claims.md", project: "alpha", at: NOW, state: { verdict: "approved", parsed: NOW } },
  { id: "ARC-001", kind: "arc", path: "RFCs/arcs/ARC-001-the-body.md", project: "alpha", at: NOW, state: { verdict: "approved", parsed: NOW } },
  { id: "GAP-003", kind: "gap", path: "RFCs/gaps/GAP-003-the-lack.md", project: "beta", at: NOW, state: { parsed: NOW } },
  { id: "kept", kind: "report", path: "meetings/kept.md", project: "alpha", at: NOW, state: { retain: "permanent", subtype: "planning", parsed: NOW } },
  { id: "unread", kind: "report", path: "meetings/unread.md", project: "beta", at: NOW, state: { retain: "7d", subtype: "planning", parsed: NOW } },
  { id: "MOCK-RFC", kind: "rfc", path: "RFCs/proofs/mock-rfc.md", project: "alpha", at: NOW, state: { fixture: true, parsed: NOW } },
  // THE REGISTRY POINTING AT A FILE THAT IS GONE — drawn, counted, and never read.
  { id: "RFC-099", kind: "rfc", path: "RFCs/RFC-099-vanished.md", project: "beta", at: NOW, missing: true, state: { parsed: NOW } },
  // AND ONE THE FILE HAS DRIFTED PAST — the motion trail.
  { id: "RFC-100", kind: "rfc", path: "RFCs/RFC-072-the-claims.md", project: "beta", at: NOW, stale: true, state: { parsed: NOW } },
];

/** The rows exactly as the page's own fetch hands them on: the row, plus its file's text. */
const DOCS = ROWS.map((row) => (row.missing ? { row } : { row, text: FILES[row.path] || "" }));

const data = () => ({
  read: true,
  error: "",
  docs: DOCS,
  allDocs: DOCS,
  roots: ROOTS,
  beat: 0,
  open: () => {},
  only: null,
  setOnly: () => {},
  filtering: false,
});

beforeEach(() => {
  mockFiles = { ...FILES };
});

/** The original page, mounted over the fixture and awaited until the registry has landed. */
const mountPage = async () => {
  const { container } = render(
    <ServiceContext.Provider
      value={{
        SystemViewService: {
          Agent: { documentsRegistry: async () => ROWS },
          SystemView: { projectRoots: () => ROOTS },
        },
      }}
    >
      <DashboardA />
    </ServiceContext.Provider>,
  );
  await within(container).findByText("ship the read path?");
  return container;
};

/** The tile, mounted over the same rows with no hub at all. */
const mountTile = (Tile) => render(<Tile data={data()} />).container;

describe("the fixture itself is worth comparing over", () => {
  it("draws every shape the page has — otherwise the equality below proves the easy half", async () => {
    const page = await mountPage();
    expect(page.querySelectorAll(".dba-lane").length).toBeGreaterThan(2);
    expect(page.querySelectorAll(".dba-track .dba-mark").length).toBeGreaterThan(3);
    expect(page.querySelectorAll(".dba-owed").length).toBeGreaterThan(2);
    expect(page.querySelector(".dba-mark.is-gone")).toBeInTheDocument();
    expect(page.querySelector(".dba-mark.is-stale")).toBeInTheDocument();
    expect(page.querySelector(".dba-pile")).toBeInTheDocument();
    expect(page.querySelector(".dba__fixtures")).toBeInTheDocument();
    expect(page.querySelector(".dba-lane.is-quiet")).toBeInTheDocument();
  });
});

describe("tile over section, node for node", () => {
  it("owed — the tile's DOM EQUALS the page's `.dba__owed`", async () => {
    const page = await mountPage();
    const tile = mountTile(OwedTileA);
    expect(tile.querySelector(".dba__owed").outerHTML).toEqual(page.querySelector(".dba__owed").outerHTML);
  });

  it("standing — the tile's DOM EQUALS the page's `.dba__flow`", async () => {
    const page = await mountPage();
    const tile = mountTile(StandingTileA);
    expect(tile.querySelector(".dba__flow").outerHTML).toEqual(page.querySelector(".dba__flow").outerHTML);
  });

  it("head — the tile's DOM EQUALS the page's `.dba__top`", async () => {
    const page = await mountPage();
    const tile = mountTile(HeadTileA);
    expect(tile.querySelector(".dba__top").outerHTML).toEqual(page.querySelector(".dba__top").outerHTML);
  });
});

// THE SECTIONS ALSO HAVE TO MATCH WITH THE SWITCH THROWN, or the equality above only proves the
// default. The fixtures toggle changes what every section is allowed to count.
describe("tile over section, with the fixtures shown", () => {
  const showOn = (root) => root.querySelector(".dba__fixtures input").click();

  it("owed and standing still equal their sections once the fixtures are in", async () => {
    const page = await mountPage();
    showOn(page);
    // the tile's switch lives in the head, so the two have to be mounted under one fold
    const { container: tiles } = render(
      <FoldHarness>
        <HeadTileA data={data()} />
        <OwedTileA data={data()} />
        <StandingTileA data={data()} />
      </FoldHarness>,
    );
    showOn(tiles);
    expect(tiles.querySelector(".dba__owed").outerHTML).toEqual(page.querySelector(".dba__owed").outerHTML);
    expect(tiles.querySelector(".dba__flow").outerHTML).toEqual(page.querySelector(".dba__flow").outerHTML);
    expect(tiles.querySelector(".dba__mast").outerHTML).toEqual(page.querySelector(".dba__mast").outerHTML);
  });
});

// eslint-disable-next-line import/first
const { DashboardAFold } = require("./fold");
const FoldHarness = ({ children }) => <DashboardAFold data={data()}>{children}</DashboardAFold>;

// AND THE TILES PRESS NOTHING, same as the page. The only event this surface may emit is the one
// opener every file address in this window already rides.
it("a tile emits the one opener and nothing else, exactly as the page does", async () => {
  const seen = [];
  const listen = (e) => seen.push(e.detail);
  window.addEventListener("sv:openFileInNav", listen);
  render(<OwedTileA data={{ ...data(), open: undefined }} />);
  screen.getByRole("button", { name: /ship the read path\?/ }).click();
  window.removeEventListener("sv:openFileInNav", listen);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toMatchObject({ projectCode: "alpha", path: "RFCs/RFC-071-read-path.md", language: "markdown" });
});
