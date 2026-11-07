import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ServiceContext from "../../../../ServiceContext";
import DashboardC from "../../../DashboardC/DashboardC";
import { DashboardDataProvider, useDashboardData } from "../../dashboardData";
import { HeadTileC, OwedTileC, ProjectsTileC, StandingTileC, TILES } from "./index";

// ═══ THE TILES ARE THE PAGE, PROVED BY EQUALITY ════════════════════════════════════════════════
//
// C's four sections now exist twice on purpose: inline in `DashboardC.js`, which is untouched so
// he can put the two side by side, and here as tiles that can stand anywhere. A copy is only
// worth having if it is the SAME, and "looks the same to me" is exactly the judgement this test
// exists to replace — so the page and the tiles are mounted over one fixture and their DOM is
// compared character for character.
//
// THREE OF THE FOUR ARE EQUAL WHOLE AND ARE ASSERTED AS EQUAL WHOLE: `.dbc-owes`, `.dbc-current`
// and `.dbc-shelves`, outerHTML against outerHTML, at rest and again after a stack and a fold
// have been pressed open.
//
// THE HEAD IS THE ONE THAT CANNOT BE COMPARED WHOLE, and only because of what a press DOES. It
// says the same words — same title, same inventory line, same segments with the same keys in the
// same order — and those are asserted piece by piece here. What differs is where the press lands:
// the page narrows the list under it out of its own state, the tile hands the key to the shared
// read and narrows every tile on the surface. That difference is asserted below rather than
// described, so neither half can drift unnoticed.

var mockFiles = null;
jest.mock("../../../../utils/hostFiles", () => ({
  hostFiles: () => ({
    readFile: async ({ path }) => {
      if (!mockFiles || !(path in mockFiles)) throw new Error("no hub in jsdom");
      return { path, content: mockFiles[path] };
    },
  }),
}));

const ROW = (over = {}) => ({ id: "RFC-001", kind: "rfc", path: "a.md", project: "alpha", at: 1, state: {}, ...over });

// NO REPORTS IN THE FIXTURE, deliberately: a report's meter is a clock drawn against `now`, and
// two mounts a millisecond apart would differ in a way that means nothing. Everything else on
// this page is a pure function of the text.
const SERVICE = {
  Agent: {
    documentsRegistry: async () => [
      ROW({ id: "RFC-001", path: "a.md", state: { verdict: "approved", parsed: 1 } }),
      ROW({ id: "ARC-9", kind: "arc", path: "b.md", state: { verdict: "approved", parsed: 1 } }),
      ROW({ id: "GAP-3", kind: "gap", path: "c.md", state: { parsed: 1 } }),
    ],
  },
  SystemView: { projectRoots: async () => ({ alpha: "/a", beta: "/b" }) },
};

const FILES = {
  "a.md": [
    "# RFC-001",
    "",
    "::rfc{id=RFC-001}",
    "",
    ':::approval{ask="ship the read path?"}',
    "sign it",
    ":::",
    "",
    "::claims",
    "1. [x] the read lands",
    "2. [ ] the write lands",
    "::",
  ].join("\n"),
  "b.md": [
    "# ARC-9",
    "",
    "::arc{id=ARC-9}",
    "",
    ":::objective{id=O1 owner=you state=open}",
    "mine to do",
    ":::",
    ':::objective{id=O2 state=blocked blocked="waiting on the rewrite"}',
    "stuck",
    ":::",
  ].join("\n"),
  "c.md": ["# GAP-3", "", "::gap{id=GAP-3 state=open}", "", "the thing is missing"].join("\n"),
};

beforeEach(() => {
  mockFiles = FILES;
});

/** THE TILES, STANDING WHERE THE PAGE IS NOT — no `.dbc` around them, which is the whole point of
 *  the `.dbc-ctx` wrapper each one brings with it. */
const Surface = () => {
  const data = useDashboardData();
  return (
    <div className="a-surface">
      <HeadTileC data={data} />
      <OwedTileC data={data} />
      <StandingTileC data={data} />
      <ProjectsTileC data={data} />
    </div>
  );
};

const wrap = (node) => <ServiceContext.Provider value={{ SystemViewService: SERVICE }}>{node}</ServiceContext.Provider>;

const bothUp = async () => {
  const page = render(wrap(<DashboardC />));
  const tiles = render(
    wrap(
      <DashboardDataProvider>
        <Surface />
      </DashboardDataProvider>,
    ),
  );
  await waitFor(() => {
    expect(page.container.querySelector(".dbc-shelves")).toBeTruthy();
    expect(tiles.container.querySelector(".dbc-shelves")).toBeTruthy();
  });
  return { page, tiles, of: (view, sel) => view.container.querySelector(sel) };
};

// THE TILES HAVE SINCE MOVED ON FROM THE PAGE, BY HIS RULINGS (2026-11-06), and the divergences
// are NAMED here rather than quietly exempted — the page stays as the frozen record of what the
// tiles came from:
//
//   THE ARROW: *"Nothing should actually be clicked to travel, except an explicit symbol, like
//   an arrow."* So the tiles' rows and cards grew `.dbc-go` arrows and their bodies stopped being
//   doors; the page's rows still open on their body.
//
//   THE FILTER WENT POSITIONAL: *"They should be filtering everything below them."* The press
//   lives in the STACK now (TileStack.filters.test.js proves it); a tile standing alone has no
//   stack to publish to, so its head draws labels, not controls.
//
// Everything the extraction carried over still has to SAY the same thing, so the words are
// compared with the arrows stripped out.
const saidBy = (el) => (el ? el.textContent.replace(/→/g, "") : "");

describe("a tile says exactly what the page's own section says", () => {
  it("what is owed — both columns, every sentence; only the arrows are new", async () => {
    const { page, tiles, of } = await bothUp();
    expect(saidBy(of(tiles, ".dbc-owes"))).toBe(saidBy(of(page, ".dbc-owes")));
    // one arrow per row — the explicit symbol, and the page has none
    const rows = tiles.container.querySelectorAll(".dbc-owes .dbc-owed__g");
    expect(rows.length).toBeGreaterThan(0);
    expect(tiles.container.querySelectorAll(".dbc-owes .dbc-owed__go")).toHaveLength(rows.length);
    expect(page.container.querySelectorAll(".dbc-owes .dbc-go")).toHaveLength(0);
  });

  // THE ONE SECTION STILL EQUAL WHOLE: standing (c) is not a default variant and was not rewired,
  // so it must not have drifted by accident.
  it("where everything stands — the heading, the key, every rail and every station count", async () => {
    const { page, tiles, of } = await bothUp();
    expect(of(tiles, ".dbc-current").outerHTML).toBe(of(page, ".dbc-current").outerHTML);
  });

  it("per project — every shelf, every stack, every meter; the cards' doors became arrows", async () => {
    const { page, tiles, of } = await bothUp();
    expect(saidBy(of(tiles, ".dbc-shelves"))).toBe(saidBy(of(page, ".dbc-shelves")));
    // the card is a face to read now, not a button
    expect(tiles.container.querySelectorAll(".dbc-shelves button.dbc-card")).toHaveLength(0);
    expect(page.container.querySelectorAll(".dbc-shelves div.dbc-card")).toHaveLength(0);
  });

  // A FAN IS STATE, and state is where a moved component usually loses something. Pressing the
  // same stack on both must leave both showing the same cards in the same order.
  it("and keeps saying the same thing once something is pressed open", async () => {
    const { page, tiles, of } = await bothUp();
    fireEvent.click(of(page, ".dbc-stack--arc .dbc-stack__face"));
    fireEvent.click(of(tiles, ".dbc-stack--arc .dbc-stack__face"));
    expect(saidBy(of(tiles, ".dbc-shelves"))).toBe(saidBy(of(page, ".dbc-shelves")));
  });

  // THE HEAD SAYS THE SAME WORDS. What differs: the page's head still owns a page-wide filter, so
  // its segments are buttons; a tile standing OUTSIDE a stack has nothing to publish to, so it
  // draws labels — a control that narrows nothing must not look like one. The pressable head
  // lives in TileStack.filters.test.js, where there is a stack to press into.
  it("the counts — says the same words; alone it offers no control it cannot honour", async () => {
    const { page, tiles, of } = await bothUp();
    expect(of(tiles, ".dbc-head__top").outerHTML).toBe(of(page, ".dbc-head__top").outerHTML);
    const words = (v) => [...v.container.querySelectorAll(".dbc-head__segs .dbc-seg")].map((e) => e.textContent);
    expect(words(tiles)).toEqual(words(page));
    expect(tiles.container.querySelectorAll(".dbc-head__segs button")).toHaveLength(0);
    // The skipped sentence is `owed.js`'s own either way — a surface that silently omits is the
    // failure this system exists to stop.
    const skipped = (v) => (v.container.querySelector(".dbc-head__skipped") || { textContent: "" }).textContent;
    expect(skipped(tiles)).toBe(skipped(page));
  });
});

// THE HEAD'S PRESS GOES TO THE STACK — his ruling, 2026-11-06: *"They should be filtering
// everything below them"*, never the whole page. What a held filter DOES to the tiles below is
// the stack's to prove (TileStack.filters.test.js); what is proved HERE is the tile's half of the
// contract: it publishes on the `kind` dimension, it wears the fill its `mine` says, and it
// counts the unnarrowed world whatever arrives narrowed.
describe("the head tile publishes to the stack and fills while held", () => {
  const up = async (filter) => {
    const Harness = () => <HeadTileC data={useDashboardData()} filter={filter} />;
    const view = render(
      wrap(
        <DashboardDataProvider>
          <Harness />
        </DashboardDataProvider>,
      ),
    );
    await waitFor(() => expect(view.container.querySelector(".dbc-seg")).toBeTruthy());
    return view;
  };

  it("a pressed segment publishes its key on the kind dimension", async () => {
    const set = jest.fn();
    await up({ above: {}, mine: {}, set });
    fireEvent.click(await screen.findByRole("button", { name: /approvals? waiting/ }));
    expect(set).toHaveBeenCalledWith("kind", "approval");
  });

  // THE HELD STATE HAS TO BE UNMISTAKABLE. *"Those filters need to do a better job in that
  // they're selected if we do that."* The costume is a fill in the segment's own hue, and it
  // hangs off this class — so the class is what is asserted, and that only one carries it.
  it("says which segment is held, and only one at a time", async () => {
    const view = await up({ above: {}, mine: { kind: "approval" }, set: jest.fn() });
    const on = view.container.querySelectorAll(".dbc-seg.is-on");
    expect(on).toHaveLength(1);
    expect(on[0].textContent).toMatch(/approval/);
    expect(on[0]).toHaveAttribute("aria-pressed", "true");
  });

  // A HEAD COUNTS THE WORLD IT FILTERS FROM. The stack hands it narrowed `docs` like everyone
  // else when something is held ABOVE it, and the counts still come off `allDocs` / `allOwed`.
  it("keeps its own counts unnarrowed when the data arrives narrowed", async () => {
    const whole = await up({ above: {}, mine: {}, set: jest.fn() });
    const before = whole.container.querySelector(".dbc-head").textContent;
    whole.unmount();
    const Narrowed = () => {
      const data = useDashboardData();
      return <HeadTileC data={{ ...data, docs: [] }} filter={{ above: { project: "beta" }, mine: {}, set: jest.fn() }} />;
    };
    const view = render(
      wrap(
        <DashboardDataProvider>
          <Narrowed />
        </DashboardDataProvider>,
      ),
    );
    await waitFor(() => expect(view.container.querySelector(".dbc-seg")).toBeTruthy());
    expect(view.container.querySelector(".dbc-head").textContent).toBe(before);
  });

  // THE SEGMENTS ARE WHATEVER `owedHead` EMITS, never a list this tile knows in advance.
  // Outstanding used to be one lump and is now broken out by what the work IS; a head that
  // switched on the keys it could see would silently drop the next one, and an undercount reads
  // as RESOLVED, which is the one thing this number may never say.
  it("renders a pill per segment the head module returns, whatever they turn out to be", async () => {
    const view = await up({ above: {}, mine: {}, set: jest.fn() });
    const pills = [...view.container.querySelectorAll(".dbc-head__segs .dbc-seg")];
    const keys = pills.map((e) => [...e.classList].find((c) => c.startsWith("is-")));
    expect(keys).toContain("is-approval");
    expect(keys).toContain("is-mine");
    expect(keys).toContain("is-blocked");
    // The lump is gone: nothing reads "outstanding" on its own any more.
    expect(keys).not.toContain("is-work");
    // Nothing is rendered beside the pills, so they all wrap in the one row.
    expect(view.container.querySelectorAll(".dbc-head__segs > *")).toHaveLength(pills.length);
  });
});

// A TILE STANDING ALONE MUST NOT EXPLODE AND MUST NOT LIE. Rendered with no data at all it says
// nothing was read, which is the one state this surface may never turn into "nothing to do".
describe("a tile with nothing handed to it", () => {
  it("draws its emptiness rather than a clear desk, and offers no control it cannot honour", () => {
    const view = render(<HeadTileC data={null} />);
    expect(view.container.querySelector(".dbc-void").textContent).toMatch(/not an empty inbox/);
    expect(view.container.querySelectorAll(".dbc-head__segs button")).toHaveLength(0);
  });

  it("the rest simply render nothing — an empty section is not an answer", () => {
    expect(render(<OwedTileC data={null} />).container.innerHTML).toBe("");
    expect(render(<StandingTileC data={null} />).container.innerHTML).toBe("");
    expect(render(<ProjectsTileC data={null} />).container.innerHTML).toBe("");
  });
});

// THE INVENTORY IS ONE LIST IN ONE FILE — what C offers the registry, greppable without knowing
// what happened to be imported.
it("offers one tile per kind C has, each a registry entry with a component", () => {
  expect(TILES.map((t) => t.kind)).toEqual(["head", "owed", "standing", "projects"]);
  for (const t of TILES) {
    expect(t.variant).toBe("c");
    expect(typeof t.Component).toBe("function");
    expect(t.label).toBeTruthy();
  }
});
