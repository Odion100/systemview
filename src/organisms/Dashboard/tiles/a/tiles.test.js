// ─── A'S TILES, EACH ON ITS OWN ────────────────────────────────────────────────────────────────
//
// The page's test holds the COMPOSITION to its old DOM. This one holds each tile to the contract
// that lets it stand anywhere else: one prop, no hub, no timer, and a section that still paints
// because the wrapper it brings carries the context the page used to inherit down.
//
// EVERY MOUNT HERE IS HUBLESS ON PURPOSE. No `ServiceContext`, no `hostFiles`, no provider — just
// a hand-built `data` object. A tile that reached for the registry would have nothing to reach
// with, which is the point being asserted: the read is upstairs.
import React from "react";
import { render, screen, within } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { HeadTileA, OwedTileA, StandingTileA, DashboardAFold, TILES } from "./index";

const NOW = Date.now();

const doc = (row, text) => ({ row: { project: "alpha", at: NOW, state: { parsed: NOW }, ...row }, text });

const APPROVAL = doc(
  { id: "RFC-071", kind: "rfc", path: "RFCs/RFC-071.md", state: { verdict: "approved", parsed: NOW } },
  ["# RFC-071", "", '::rfc{id=RFC-071 title="the read path"}', "", ':::approval{ask="ship the read path?"}', "sign it", ":::"].join("\n"),
);
const BLOCKED = doc(
  { id: "ARC-001", kind: "arc", path: "RFCs/arcs/ARC-001.md", state: { verdict: "approved", parsed: NOW } },
  [
    "# ARC-001",
    "",
    '::arc{id=ARC-001 title="the body of work"}',
    "",
    ':::objective{id=O1 title="the first" state=blocked blocked="waiting on the rewrite"}',
    "the first thing",
    ":::",
  ].join("\n"),
);

/** What the surface hands a tile. Nothing else is in scope for one. */
const data = (docs, over = {}) => ({
  read: true,
  error: "",
  docs,
  allDocs: docs,
  roots: { alpha: "/repos/alpha" },
  beat: 0,
  open: jest.fn(),
  only: null,
  setOnly: jest.fn(),
  filtering: false,
  ...over,
});

describe("the inventory", () => {
  it("declares three tiles, all variant a, each with a component", () => {
    expect(TILES.map((t) => t.kind)).toEqual(["head", "owed", "standing"]);
    for (const t of TILES) {
      expect(t.variant).toBe("a");
      expect(typeof t.Component).toBe("function");
      expect(t.label).toMatch(/\S/);
    }
  });

  // THE KINDS A DOES NOT HAVE ARE A STATEMENT, not an oversight. A has no standalone reports
  // section — the stack is the end of each project's track — and no lane block that stands up
  // without the axis labelling its columns. Registering an invented one would put a second answer
  // about what is retiring on the same surface as the first.
  it("claims no kind A does not have", () => {
    expect(TILES.map((t) => t.kind)).not.toContain("reports");
    expect(TILES.map((t) => t.kind)).not.toContain("projects");
  });

  // NOT A GREP FOR TIDINESS. A tile that opened its own registry read or started its own poll is
  // the exact failure the one-read contract exists to stop, and it is invisible in a render test:
  // the page would still look right while three tiles drifted apart between ticks.
  it("reads no registry and holds no timer, in any of its files", () => {
    const dir = __dirname;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"))) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect({ f, hit: /documentsRegistry|useRegistryRead|hostFiles|projectRoots/.test(src) }).toEqual({ f, hit: false });
      expect({ f, hit: /setInterval|setTimeout/.test(src) }).toEqual({ f, hit: false });
    }
  });
});

describe("every tile stands alone", () => {
  it.each([
    ["head", HeadTileA, ".dba__top"],
    ["owed", OwedTileA, ".dba__owed"],
    ["standing", StandingTileA, ".dba__flow"],
  ])("%s renders its section inside the context wrapper, with no hub anywhere", (_name, Tile, sel) => {
    const { container } = render(<Tile data={data([APPROVAL, BLOCKED])} />);
    // THE WRAPPER IS THE WHOLE POINT. Outside `.dba` a section loses `--dba-rfc` and every other
    // hue, and an undefined custom property paints NOTHING — not a wrong colour, no colour. So
    // the tile brings the context class with it rather than relying on where it was dropped.
    expect(container.firstChild.className).toBe("dba-ctx");
    expect(container.querySelector(sel)).toBeInTheDocument();
    expect(container.querySelector(sel).parentElement).toBe(container.firstChild);
  });

  it.each([
    ["head", HeadTileA],
    ["owed", OwedTileA],
    ["standing", StandingTileA],
  ])("%s says nothing rather than throwing when it is handed no data at all", (_name, Tile) => {
    expect(() => render(<Tile />)).not.toThrow();
  });
});

describe("the head", () => {
  it("draws owedHead's segments, in its words, with the reading line above them", () => {
    render(<HeadTileA data={data([APPROVAL, BLOCKED])} />);
    expect(screen.getByText("What is going on, and what needs you")).toBeInTheDocument();
    expect(document.querySelector(".dba__reading").textContent).toMatch(/documents read/);
    expect(document.querySelectorAll(".dba__gauge .dba-tile").length).toBeGreaterThan(0);
    expect(screen.getByText(/approval waiting/)).toBeInTheDocument();
  });

  // THE COUNTS ARE WHAT YOU FILTER FROM. Press one and the head must still say how much there was.
  it("counts the whole registry even while the surface is narrowed", () => {
    const whole = [APPROVAL, BLOCKED];
    const narrowed = render(<HeadTileA data={data(whole)} />);
    const before = [...document.querySelectorAll(".dba__gauge .dba-tile")].map((t) => t.textContent);
    const line = document.querySelector(".dba__reading").textContent;
    narrowed.rerender(
      <HeadTileA data={data([APPROVAL], { allDocs: whole, only: "approval", filtering: true })} />,
    );
    expect([...document.querySelectorAll(".dba__gauge .dba-tile")].map((t) => t.textContent)).toEqual(before);
    expect(document.querySelector(".dba__reading").textContent).toBe(line);
  });

  it("offers no fixtures switch when the registry holds no fixtures", () => {
    render(<HeadTileA data={data([APPROVAL])} />);
    expect(document.querySelector(".dba__fixtures")).toBeNull();
  });

  it("says the registry could not be read rather than drawing a clear page", () => {
    render(<HeadTileA data={data([], { read: false, error: "the hub is not connected yet" })} />);
    expect(screen.getByText(/could not be read — the hub is not connected yet/)).toBeInTheDocument();
  });
});

describe("the owed tile", () => {
  it("puts press on one side and outstanding on the other, in owed.js's own words", () => {
    render(<OwedTileA data={data([APPROVAL, BLOCKED])} />);
    const halves = [...document.querySelectorAll(".dba__half h2")].map((h) => h.textContent);
    expect(halves).toEqual(["Press your signature finishes it", "Outstanding nobody can press it away"]);
    expect(screen.getByText("ship the read path?")).toBeInTheDocument();
    expect(screen.getByText(/waiting on the rewrite/)).toBeInTheDocument();
  });

  it("opens the document through the surface's opener and presses nothing", () => {
    const d = data([APPROVAL]);
    render(<OwedTileA data={d} />);
    screen.getByRole("button", { name: /ship the read path\?/ }).click();
    expect(d.open).toHaveBeenCalledWith(expect.objectContaining({ project: "alpha", path: "RFCs/RFC-071.md" }));
  });

  it("says NOT MEASURED, never 'nothing', over a registry nobody could read", () => {
    render(<OwedTileA data={data([], { read: false })} />);
    expect(screen.getAllByText("not measured")).toHaveLength(2);
  });

  it("narrows with the surface — it reads docs, which the provider has already cut", () => {
    const { rerender } = render(<OwedTileA data={data([APPROVAL, BLOCKED])} />);
    expect(screen.getByText(/waiting on the rewrite/)).toBeInTheDocument();
    rerender(<OwedTileA data={data([APPROVAL], { allDocs: [APPROVAL, BLOCKED], only: "approval", filtering: true })} />);
    expect(screen.queryByText(/waiting on the rewrite/)).not.toBeInTheDocument();
    expect(screen.getByText("ship the read path?")).toBeInTheDocument();
  });
});

describe("the standing tile", () => {
  it("heads the lanes with the axis, and the axis columns are the phases in travel order", () => {
    render(<StandingTileA data={data([APPROVAL, BLOCKED])} />);
    expect([...document.querySelectorAll(".dba-axis__col b")].map((b) => b.textContent)).toEqual([
      "proposed",
      "agreed",
      "moving",
      "landed",
      "set down",
      "reports",
    ]);
    // ONE TILE, NOT TWO: the axis and every track are siblings in one section, which is what lets
    // them share one grid and line their columns up.
    const flow = document.querySelector(".dba__flow");
    expect(flow.querySelector(".dba-axis").parentElement).toBe(flow);
    expect(flow.querySelector(".dba-lane").parentElement).toBe(flow);
  });

  it("draws one lane per project and one mark per travelling document", () => {
    render(<StandingTileA data={data([APPROVAL, BLOCKED])} />);
    expect(document.querySelectorAll(".dba-lane")).toHaveLength(1);
    expect(within(document.querySelector(".dba-lane")).getByText("alpha")).toBeInTheDocument();
    expect(document.querySelectorAll(".dba-track .dba-mark")).toHaveLength(2);
  });

  it("draws a project with nothing registered and says WHY it is empty", () => {
    render(<StandingTileA data={data([], { roots: { gamma: "/repos/gamma" } })} />);
    expect(screen.getByText("gamma")).toBeInTheDocument();
    expect(screen.getByText(/nothing registered/)).toBeInTheDocument();
  });

  it("opens a mark's document through the surface's opener", () => {
    const d = data([APPROVAL]);
    render(<StandingTileA data={d} />);
    document.querySelector(".dba-track .dba-mark").click();
    expect(d.open).toHaveBeenCalledWith(expect.objectContaining({ project: "alpha", path: "RFCs/RFC-071.md" }));
  });
});

// ─── THE FOLD ──────────────────────────────────────────────────────────────────────────────────
//
// A's fixtures switch is in the head and governs what the other two are allowed to count. Three
// copies of it would give him a header saying eleven fixtures are showing over lanes still hiding
// them — the one-read problem, one layer up.
describe("tiles inside one fold share the switch", () => {
  const FIXTURE = doc(
    { id: "MOCK-RFC", kind: "rfc", path: "RFCs/proofs/mock.md", state: { fixture: true, verdict: "approved", parsed: NOW } },
    ['# MOCK', "", '::rfc{id=MOCK-RFC title="a fixture" fixture=true}'].join("\n"),
  );

  it("hides the fixture everywhere, then shows it everywhere, off one press", () => {
    const d = data([APPROVAL, FIXTURE]);
    render(
      <DashboardAFold data={d}>
        <HeadTileA data={d} />
        <StandingTileA data={d} />
      </DashboardAFold>,
    );
    expect(document.querySelectorAll(".dba-track .dba-mark")).toHaveLength(1);
    const box = document.querySelector(".dba__fixtures input");
    expect(box).toBeInTheDocument();
    box.click();
    // the head's own sentence changed AND the lane grew a mark — one switch, both sections
    expect(document.querySelector(".dba__reading").textContent).toMatch(/fixtures? shown/);
    expect(document.querySelectorAll(".dba-track .dba-mark")).toHaveLength(2);
  });

  it("a tile outside a fold still has its own switch rather than none", () => {
    render(<HeadTileA data={data([APPROVAL, FIXTURE])} />);
    const box = document.querySelector(".dba__fixtures input");
    box.click();
    expect(document.querySelector(".dba__reading").textContent).toMatch(/fixtures? shown/);
  });
});
