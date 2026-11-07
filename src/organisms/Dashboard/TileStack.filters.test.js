import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ServiceContext from "../../ServiceContext";
import TileStack from "./TileStack";

// ─── THE STACK IS WHERE PLACEMENT BECOMES SCOPE ────────────────────────────────────────────────
//
// His ruling, 2026-11-06, verbatim: *"They should be filtering everything below them."* The
// tiles' own suites prove each tile's half of the contract (it publishes, it fills, it narrows a
// handed-down list); THIS file proves the stack's half — a selection reaches every tile below the
// one that holds it, reaches nothing above it, follows position when the order is read, and lets
// go on the second press.
//
// And the second ruling of the same day: *"Nothing should actually be clicked to travel, except
// an explicit symbol, like an arrow, to open the next page. And it actually should travel."* The
// arrow's travel is asserted against the window's own location, because that is what travel IS.

var mockFiles = null;
jest.mock("../../utils/hostFiles", () => ({
  hostFiles: () => ({
    readFile: async ({ path }) => {
      if (!mockFiles || !(path in mockFiles)) throw new Error("no hub in jsdom");
      return { path, content: mockFiles[path] };
    },
  }),
}));

const ROW = (over = {}) => ({ id: "RFC-001", kind: "rfc", path: "a.md", project: "alpha", at: 1, state: {}, ...over });

const SERVICE = {
  Agent: {
    documentsRegistry: async () => [
      // The RFC is PLANNED INTO the arc — its leaf carries the address, which is what the arc
      // filter resolves by.
      ROW({ id: "RFC-001", path: "a.md", arc: "ARC-9-O1", state: { verdict: "approved", parsed: 1 } }),
      ROW({ id: "ARC-9", kind: "arc", path: "b.md", state: { verdict: "approved", parsed: 1 } }),
      ROW({ id: "GAP-3", kind: "gap", path: "c.md", project: "beta", state: { parsed: 1 } }),
    ],
  },
  SystemView: { projectRoots: async () => ({ alpha: "/a", beta: "/b" }) },
};

const FILES = {
  "a.md": [
    "# RFC-001",
    "",
    "::rfc{id=RFC-001 arc=ARC-9-O1}",
    "",
    ':::approval{ask="ship the read path?"}',
    "sign it",
    ":::",
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
  window.history.pushState({}, "", "/");
});

const up = async (tiles) => {
  const view = render(
    <ServiceContext.Provider value={{ SystemViewService: SERVICE }}>
      <TileStack page={{ id: "p1", tiles }} onChange={() => {}} />
    </ServiceContext.Provider>,
  );
  await waitFor(() => expect(view.container.querySelector(".dbc-ctx, .dbb-ctx")).toBeTruthy());
  return view;
};

// ─── 1. A HEAD FILTERS EVERYTHING BELOW IT, AND NOTHING ABOVE IT ───────────────────────────────

it("a head's press narrows every tile below it and leaves the tile above it whole", async () => {
  // The owed tile stands ABOVE the head on purpose — it is the witness.
  const view = await up([
    { kind: "owed", variant: "c" },
    { kind: "head", variant: "c" },
    { kind: "standing", variant: "c" },
    { kind: "projects", variant: "c" },
  ]);
  await waitFor(() => expect(view.container.querySelector(".dbc-shelves")).toBeTruthy());
  const waiting = await screen.findByRole("button", { name: /approvals? waiting/ });
  expect(view.container.querySelector(".dbc-track--arc")).toBeTruthy();
  expect(view.container.querySelector(".dbc-track--gap")).toBeTruthy();

  fireEvent.click(waiting);
  // BELOW: only the RFC holds an approval, so the arc and gap tracks leave the standing tile and
  // beta's shelf loses its documents.
  expect(view.container.querySelector(".dbc-track--rfc")).toBeTruthy();
  expect(view.container.querySelector(".dbc-track--arc")).toBeNull();
  expect(view.container.querySelector(".dbc-track--gap")).toBeNull();
  // ABOVE: the owed tile still says everything — the arc's folded row included. (The blocked
  // sentence itself is behind the fold; the row's presence is the witness.)
  const above = view.container.querySelector(".dbc-owes").textContent;
  expect(above).toContain("ARC-9");
  expect(above).toContain("ship the read path?");

  // AND IT LETS GO. A filter you cannot get out of is a trap.
  fireEvent.click(waiting);
  expect(view.container.querySelector(".dbc-track--arc")).toBeTruthy();
});

// ─── 2. THE PROJECTS TILE FILTERS PER PROJECT ──────────────────────────────────────────────────

it("pressing a project name narrows the tiles below to that project, with a visible fill", async () => {
  const view = await up([
    { kind: "projects", variant: "c" },
    { kind: "standing", variant: "c" },
  ]);
  await waitFor(() => expect(view.container.querySelector(".dbc-shelf__pick")).toBeTruthy());
  const beta = [...view.container.querySelectorAll(".dbc-shelf__pick")].find((b) => b.textContent === "beta");

  fireEvent.click(beta);
  expect(beta.className).toMatch(/\bis-on\b/);
  expect(beta).toHaveAttribute("aria-pressed", "true");
  // below: only beta's gap is standing anywhere
  expect(view.container.querySelector(".dbc-track--gap")).toBeTruthy();
  expect(view.container.querySelector(".dbc-track--rfc")).toBeNull();
  expect(view.container.querySelector(".dbc-track--arc")).toBeNull();
  // the projects tile itself is NOT narrowed by its own selection — every shelf still stands
  expect(view.container.querySelectorAll(".dbc-shelf").length).toBe(2);

  fireEvent.click(beta);
  expect(view.container.querySelector(".dbc-track--rfc")).toBeTruthy();
});

// ─── 3. AN ARC IS A FILTER FOR THE RFCs THAT SERVE IT ──────────────────────────────────────────

it("pressing an arc bead narrows the tiles below to the arc and its planned RFCs", async () => {
  const view = await up([
    { kind: "standing", variant: "b" },
    { kind: "owed", variant: "c" },
  ]);
  await waitFor(() => expect(view.container.querySelector(".dbb-track--arc .dbb-bead__body")).toBeTruthy());
  // the gap's obligation is below before the press
  expect(view.container.querySelector(".dbc-owes")).toBeTruthy();

  fireEvent.click(view.container.querySelector(".dbb-track--arc .dbb-bead__body"));
  expect(view.container.querySelector(".dbb-bead.is-on")).toBeTruthy();
  // below: only obligations on the arc and its planned RFC survive
  const saidBelow = view.container.querySelector(".dbc-owes").textContent;
  expect(saidBelow).toContain("ship the read path?");
  expect(saidBelow).toContain("ARC-9");
  expect(saidBelow).not.toContain("GAP-3");
});

// ─── 4. NOTHING TRAVELS BUT THE ARROW, AND THE ARROW REALLY TRAVELS ────────────────────────────

it("a row's body moves the window nowhere; the arrow takes it to the Code page's file route", async () => {
  const view = await up([{ kind: "projects", variant: "c" }]);
  await waitFor(() => expect(view.container.querySelector(".dbc-stack__face")).toBeTruthy());
  // fan a stack open to reach a card
  fireEvent.click(view.container.querySelector(".dbc-stack--rfc .dbc-stack__face"));
  const card = view.container.querySelector(".dbc-card");
  expect(card.tagName).not.toBe("BUTTON");

  fireEvent.click(card);
  expect(window.location.pathname).toBe("/");

  fireEvent.click(card.querySelector(".dbc-card__go"));
  expect(window.location.pathname).toBe("/specs/alpha");
  const q = new URLSearchParams(window.location.search);
  expect(q.get("tab")).toBe("docs");
  expect(q.get("file")).toBe("a.md");
  expect(q.get("fproj")).toBe("alpha");
});
