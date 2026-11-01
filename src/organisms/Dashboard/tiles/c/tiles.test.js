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

describe("a tile renders exactly what the page's own section renders", () => {
  it("what is owed — both columns, the fold, every sentence", async () => {
    const { page, tiles, of } = await bothUp();
    expect(of(tiles, ".dbc-owes").outerHTML).toBe(of(page, ".dbc-owes").outerHTML);
  });

  it("where everything stands — the heading, the key, every rail and every station count", async () => {
    const { page, tiles, of } = await bothUp();
    expect(of(tiles, ".dbc-current").outerHTML).toBe(of(page, ".dbc-current").outerHTML);
  });

  it("per project — every shelf, every stack, every meter", async () => {
    const { page, tiles, of } = await bothUp();
    expect(of(tiles, ".dbc-shelves").outerHTML).toBe(of(page, ".dbc-shelves").outerHTML);
  });

  // A FAN IS STATE, and state is where a moved component usually loses something. Pressing the
  // same stack on both must leave both showing the same cards in the same order.
  it("and keeps rendering the same thing once something is pressed open", async () => {
    const { page, tiles, of } = await bothUp();
    fireEvent.click(of(page, ".dbc-stack--arc .dbc-stack__face"));
    fireEvent.click(of(tiles, ".dbc-stack--arc .dbc-stack__face"));
    expect(of(tiles, ".dbc-shelves").outerHTML).toBe(of(page, ".dbc-shelves").outerHTML);

    fireEvent.click(of(page, ".dbc-owes .dbc-owed"));
    fireEvent.click(of(tiles, ".dbc-owes .dbc-owed"));
    expect(of(tiles, ".dbc-owes").outerHTML).toBe(of(page, ".dbc-owes").outerHTML);
  });

  // THE HEAD IS THE ONE THAT DIFFERS, AND HERE IS EXACTLY HOW. Everything it SAYS is the same —
  // the title, the inventory line, the segments and their words, the skipped sentence. What it
  // does with a press is not, and that is the change: the page narrows the section under it, the
  // tile narrows the surface.
  it("the counts — says the same words, and differs only in where the press lands", async () => {
    const { page, tiles, of } = await bothUp();
    expect(of(tiles, ".dbc-head__top").outerHTML).toBe(of(page, ".dbc-head__top").outerHTML);
    const words = (v) => [...v.container.querySelectorAll(".dbc-head__segs .dbc-seg")].map((e) => e.textContent);
    expect(words(tiles)).toEqual(words(page));
    const keys = (v) =>
      [...v.container.querySelectorAll(".dbc-head__segs .dbc-seg")].map((e) => `${e.tagName}:${e.className}`);
    expect(keys(tiles)).toEqual(keys(page));
    // The skipped sentence is `owed.js`'s own either way — a surface that silently omits is the
    // failure this system exists to stop.
    const skipped = (v) => (v.container.querySelector(".dbc-head__skipped") || { textContent: "" }).textContent;
    expect(skipped(tiles)).toBe(skipped(page));
  });
});

describe("the head tile presses the surface, not the section under it", () => {
  const up = async () => {
    const view = render(
      wrap(
        <DashboardDataProvider>
          <Surface />
        </DashboardDataProvider>,
      ),
    );
    await waitFor(() => expect(view.container.querySelector(".dbc-shelves")).toBeTruthy());
    return view;
  };
  // THE SEGMENT, BY ITS KEY. By accessible name is ambiguous here and that is not the test's
  // fault: a dot's title legitimately says "1 blocked" too, because the arc's own row says so.
  const seg = (view, key) => view.container.querySelector(`.dbc-seg.is-${key}`);

  // HIS RULING: *"especially because they're going to be components, those headers, if they have
  // filters, need to filter the entire, ALL of the sections."* A head that narrowed only its
  // neighbour would be reading its own placement as its scope, which stops meaning anything the
  // moment he can put it on another page.
  it("narrows the rails and the shelves from one press, not just the owed list", async () => {
    const view = await up();
    const waiting = await screen.findByRole("button", { name: /approvals? waiting/ });
    expect(view.container.querySelector(".dbc-track--arc")).toBeTruthy();
    expect(view.container.querySelector(".dbc-track--gap")).toBeTruthy();

    fireEvent.click(waiting);
    // Only the RFC holds an approval, so the arc and the gap leave every section at once.
    expect(view.container.querySelector(".dbc-track--rfc")).toBeTruthy();
    expect(view.container.querySelector(".dbc-track--arc")).toBeNull();
    expect(view.container.querySelector(".dbc-track--gap")).toBeNull();
    expect(screen.getByText("ship the read path?")).toBeVisible();
    expect(screen.queryByText(/waiting on the rewrite/)).not.toBeInTheDocument();
    // AND IT LETS GO. A filter you cannot get out of is a trap.
    fireEvent.click(waiting);
    expect(view.container.querySelector(".dbc-track--arc")).toBeTruthy();
  });

  // IT FILTERS BY OBLIGATION, NOT BY DOCUMENT. *"Of course I want to filter by obligations."*
  // Pressing "1 blocked" must show the blocked objective and not also the three other things the
  // same arc happens to owe — the list has to be what the number counted.
  it("shows exactly the obligations the segment counted, not everything their documents owe", async () => {
    const view = await up();
    fireEvent.click(seg(view, "blocked"));
    expect(screen.getByText(/waiting on the rewrite/)).toBeVisible();
    expect(screen.queryByText("mine to do")).not.toBeInTheDocument();
    expect(view.container.querySelectorAll(".dbc-owes .dbc-owed")).toHaveLength(1);
  });

  // A HEAD COUNTS THE WORLD IT FILTERS FROM. Counting the narrowed set would restate the press
  // back at itself — "1 of 1" — with no way left to see there had ever been more.
  it("keeps its own counts unnarrowed while everything else narrows", async () => {
    const view = await up();
    const before = view.container.querySelector(".dbc-head").textContent;
    fireEvent.click(await screen.findByRole("button", { name: /approvals? waiting/ }));
    expect(view.container.querySelector(".dbc-head").textContent).toBe(before);
  });

  // THE HELD STATE HAS TO BE UNMISTAKABLE. *"Those filters need to do a better job in that
  // they're selected if we do that."* The costume is a fill in the segment's own hue, and it
  // hangs off this class — so the class is what is asserted, and that only one carries it.
  it("says which segment is held, and only one at a time", async () => {
    const view = await up();
    const waiting = await screen.findByRole("button", { name: /approvals? waiting/ });
    expect(waiting.className).not.toMatch(/is-on/);
    fireEvent.click(waiting);
    expect(waiting.className).toMatch(/\bis-on\b/);
    expect(waiting).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(seg(view, "blocked"));
    expect(view.container.querySelectorAll(".dbc-seg.is-on")).toHaveLength(1);
    expect(waiting.className).not.toMatch(/is-on/);
  });

  // THE SEGMENTS ARE WHATEVER `owedHead` EMITS, never a list this tile knows in advance.
  // Outstanding used to be one lump and is now broken out by what the work IS; a head that
  // switched on the keys it could see would silently drop the next one, and an undercount reads
  // as RESOLVED, which is the one thing this number may never say.
  it("renders a pill per segment the head module returns, whatever they turn out to be", async () => {
    const view = await up();
    await waitFor(() => expect(view.container.querySelector(".dbc-seg")).toBeTruthy());
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
