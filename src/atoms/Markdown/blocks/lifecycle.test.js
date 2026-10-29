import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { stateOf, LifecycleTrail } from "./lifecycle";
import { MarkdownMembersProvider, MarkdownWriteProvider } from "../context";
import { setHub } from "../../../utils/hub";

// RFC-075 — THE TRAIL READS STATE, IT NEVER TESTIFIES. These guard the two rules that matter: the
// current state is the registry's derivation in the kind's vocabulary, and a document with no row
// shows nothing — absence stated beats a trail invented.

afterEach(() => setHub(null));

const withRegistry = (rows) =>
  setHub({ Agent: { documentsRegistry: async () => rows }, SystemView: {} });

const mount = (kind, id) =>
  render(
    <MarkdownMembersProvider value={{ projectCode: "systemview-test", source: "" }}>
      <LifecycleTrail kind={kind} id={id} />
    </MarkdownMembersProvider>,
  );

describe("stateOf — the registry's derivation in the kind's vocabulary", () => {
  it("an rfc walks draft → approved → built → settled → retired", () => {
    expect(stateOf("rfc", { state: {} })).toBe("draft");
    expect(stateOf("rfc", { state: { verdict: "approved" } })).toBe("approved");
    expect(stateOf("rfc", { state: { verdict: "approved", built: true } })).toBe("built");
    expect(stateOf("rfc", { state: { verdict: "approved", built: true, settled: true  } })).toBe("settled");
    expect(stateOf("rfc", { state: { verdict: "approved", built: true, retired: true  } })).toBe("retired");
    expect(stateOf("rfc", { state: { verdict: "rejected" } })).toBe("rejected");
  });
  it("arc, gap and report each speak their own", () => {
    // The arc runs the approval flow and derives UPWARD (RFC-076 §2) — the hand-ticked done flag
    // decides nothing, and the fold's counts on the row are what the word is read from.
    expect(stateOf("arc", { state: { done: true } })).toBe("draft");
    expect(stateOf("arc", { state: { verdict: "approved", objectives: { total: 2, planned: 1, complete: 0 } } })).toBe("approved");
    expect(stateOf("arc", { state: { verdict: "approved", objectives: { total: 2, planned: 2, complete: 1 } } })).toBe("inProgress");
    expect(stateOf("arc", { state: { verdict: "approved", objectives: { total: 2, planned: 2, complete: 2 } } })).toBe("settled");
    expect(stateOf("gap", { state: {} })).toBe("open");
    expect(stateOf("gap", { state: { done: true } })).toBe("resolved");
    expect(stateOf("report", { state: {} })).toBe("filed");
  });
});

describe("the trail — read, never invented", () => {
  it("lights the current station off the registry row", async () => {
    withRegistry([{ id: "RFC-073", state: { verdict: "approved", built: true } }]);
    mount("rfc", "RFC-073");
    const built = await screen.findByText("built");
    expect(built.closest(".sv-trail__st").className).toContain("is-at");
    expect(screen.getByText("draft").closest(".sv-trail__st").className).not.toContain("is-at");
    expect(screen.getByText("retired").closest(".sv-trail__st").className).not.toContain("is-at");
  });

  it("no registry row → no trail at all; the leaf stays the label it was", async () => {
    withRegistry([{ id: "RFC-999", state: {} }]);
    const { container } = mount("rfc", "RFC-073");
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector(".sv-trail")).toBeNull();
  });

  it("no hub at all → nothing, no error", async () => {
    const { container } = mount("rfc", "RFC-073");
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector(".sv-trail")).toBeNull();
  });

  it("a rejected RFC shows its real ending — draft → rejected, nothing after", async () => {
    withRegistry([{ id: "RFC-050", state: { verdict: "rejected" } }]);
    mount("rfc", "RFC-050");
    const dead = await screen.findByText("rejected");
    expect(dead.closest(".sv-trail__st").className).toContain("sv-trail__st--dead");
    expect(screen.queryByText("approved")).toBeNull();
    expect(screen.queryByText("built")).toBeNull();
  });
});

// THE STATIONS ARE PRESSABLE (his: *"just give me the ability to click and change it"*). What these
// guard is that a press WRITES THE DOCUMENT rather than storing a state of its own — the file is
// the single source, so the click has to come out as `setAttr` on the leaf's own line.
// `attrs` is the LEAF'S OWN LINE and it is not optional here: the leaf is authoritative for the
// stations it declares, so a test that mounts a row saying `settled` without a leaf saying it is
// testing a document that does not exist.
const mountWritable = (kind, id, write, attrs = {}) =>
  render(
    <MarkdownMembersProvider value={{ projectCode: "systemview-test", source: "" }}>
      <MarkdownWriteProvider value={{ editable: true, appendEnd: jest.fn(), ...write }}>
        <LifecycleTrail kind={kind} id={id} line={3} attrs={attrs} />
      </MarkdownWriteProvider>
    </MarkdownMembersProvider>,
  );

describe("pressing a station", () => {
  it("writes the declaration onto the leaf's own line", async () => {
    withRegistry([{ id: "RFC-1", kind: "rfc", state: { verdict: "approved", built: true } }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-1", { setAttr });
    const btn = await screen.findByRole("button", { name: "settled" });
    fireEvent.click(btn);
    expect(setAttr).toHaveBeenCalledTimes(1);
    const [line, pairs] = setAttr.mock.calls[0];
    expect(line).toBe(3);
    expect(pairs.settled).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pairs.retired).toBe(null);
  });

  it("going BACK clears the declaration instead of storing a new state", async () => {
    withRegistry([{ id: "RFC-2", kind: "rfc", state: { verdict: "approved", built: true, settled: true  } }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-2", { setAttr }, { id: "RFC-2", settled: "2026-10-27" });
    fireEvent.click(await screen.findByRole("button", { name: "built" }));
    // RFC-076 §4.2 — a cleared `retired=` takes its reason and its pointer with it, in the same
    // write, so no document is ever left standing while saying why it was put down.
    expect(setAttr.mock.calls[0][1]).toEqual({ settled: null, retired: null, retiredAs: null, supersededBy: null });
  });

  // `built` is the one station no leaf attribute declares — the claims bar already writes it as a
  // dated STATUS heading, so the press uses the same door.
  it("approved → built appends the STATUS heading rather than inventing an attribute", async () => {
    withRegistry([{ id: "RFC-3", kind: "rfc", state: { verdict: "approved" } }]);
    const appendEnd = jest.fn();
    mountWritable("rfc", "RFC-3", { setAttr: jest.fn(), appendEnd });
    fireEvent.click(await screen.findByRole("button", { name: "built" }));
    expect(appendEnd).toHaveBeenCalledWith(expect.stringMatching(/^## STATUS — built \d{4}-\d{2}-\d{2}$/));
  });

  // A dead button teaches the surface lies. A station a press cannot reach says why, out loud.
  it("a station that comes from somewhere else is REFUSED and says where from", async () => {
    withRegistry([{ id: "RFC-4", kind: "rfc", state: { verdict: "approved", built: true } }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-4", { setAttr });
    fireEvent.click(await screen.findByRole("button", { name: "approved" }));
    expect(setAttr).not.toHaveBeenCalled();
    // c21 — it names the HEADING, which is what actually blocks going back. It used to name the
    // verdict, which is true of going forward and beside the point here.
    expect(await screen.findByRole("status")).toHaveTextContent(/cannot unwrite the ## STATUS heading/);
  });

  it("an arc's settled is refused — it folds up from the plans", async () => {
    withRegistry([
      { id: "ARC-9", kind: "arc", state: { verdict: "approved", objectives: { total: 2, planned: 2, complete: 1 } } },
    ]);
    const setAttr = jest.fn();
    mountWritable("arc", "ARC-9", { setAttr });
    fireEvent.click(await screen.findByRole("button", { name: "settled" }));
    expect(setAttr).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/plans being settled/);
  });
  it("the in-flight station wears the fold's numbers — complete over total", async () => {
    withRegistry([
      { id: "ARC-10", kind: "arc", state: { verdict: "approved", objectives: { total: 3, planned: 3, complete: 1 } } },
    ]);
    mountWritable("arc", "ARC-10", { setAttr: jest.fn() });
    expect(await screen.findByText("in progress 1/3")).toBeTruthy();
  });

  // A READ-ONLY SURFACE STAYS A READ. No buttons at all where there is nothing to save to.
  it("draws plain text, not controls, where the document cannot be written", async () => {
    withRegistry([{ id: "RFC-5", kind: "rfc", state: { verdict: "approved", built: true  } }]);
    mount("rfc", "RFC-5");
    expect(await screen.findByText("built")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// HIS BUG, AT THE CONTROL. *"Didn't update automatically when you changed it."* The row is a cache
// of the last parse; the leaf is the document on screen. When they disagree the leaf wins, so a
// `settled=` removed from the file leaves the trail on `built` and the settled station PRESSABLE —
// rather than lit and answering "already settled", which is what a dead button looks like.
describe("the leaf beats a stale registry row", () => {
  it("draws the station the LEAF says, not the one the cached row says", async () => {
    withRegistry([{ id: "RFC-6", kind: "rfc", state: { verdict: "approved", built: true, settled: true } }]);
    mountWritable("rfc", "RFC-6", { setAttr: jest.fn() }, { id: "RFC-6" });
    const built = await screen.findByRole("button", { name: "built" });
    expect(built.closest(".sv-trail__st").className).toMatch(/is-at/);
    expect((await screen.findByRole("button", { name: "settled" })).className).not.toMatch(/--now/);
  });

  it("and pressing settled WRITES, instead of refusing against the cache", async () => {
    withRegistry([{ id: "RFC-7", kind: "rfc", state: { verdict: "approved", built: true, settled: true } }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-7", { setAttr }, { id: "RFC-7" });
    fireEvent.click(await screen.findByRole("button", { name: "settled" }));
    expect(setAttr).toHaveBeenCalledTimes(1);
    expect(setAttr.mock.calls[0][1].settled).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── RFC-076 §4.3 — THE REASON MENU IS WHAT THE GATE BECAME ────────────────────────────────────
//
// These are the claims you check with a control under your finger: pressing retire OPENS something
// instead of refusing (c15), the words offered change with where you stand (c16), and the one
// reason that needs a pointer asks for it rather than writing a retirement nobody can follow back.
//
// What makes this worth testing at the render level rather than only in `lifecycleState`: the rule
// lives in the pure module, but *whether the button asks at all* lives here — and a press that
// silently wrote `retired=` with no reason would pass every pure test in the file.

describe("retiring asks why — the menu, not a refusal", () => {
  it("c15 · pressing retire on a DRAFT opens the reasons instead of writing anything", async () => {
    withRegistry([{ id: "RFC-10", kind: "rfc", state: {} }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-10", { setAttr }, { id: "RFC-10" });
    fireEvent.click(await screen.findByRole("button", { name: "retired" }));
    // The press is a question, so nothing has been written yet — this is the half that would be
    // silently wrong if the menu were only decoration over an immediate write.
    expect(setAttr).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /why is this being retired/i })).toBeTruthy();
  });

  it("c16 · from draft the words are cancelled, not out of service", async () => {
    withRegistry([{ id: "RFC-11", kind: "rfc", state: {} }]);
    mountWritable("rfc", "RFC-11", { setAttr: jest.fn() }, { id: "RFC-11" });
    fireEvent.click(await screen.findByRole("button", { name: "retired" }));
    expect(screen.getByRole("button", { name: "cancelled" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "out of service" })).toBeNull();
  });

  it("c16 · and from settled it is the other way round", async () => {
    withRegistry([{ id: "RFC-12", kind: "rfc", state: { verdict: "approved", built: true, settled: true } }]);
    mountWritable("rfc", "RFC-12", { setAttr: jest.fn() }, { id: "RFC-12", settled: "2026-10-27" });
    fireEvent.click(await screen.findByRole("button", { name: "retired" }));
    expect(screen.getByRole("button", { name: "out of service" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "cancelled" })).toBeNull();
  });

  it("choosing a reason writes the retirement AND the reason, in one write", async () => {
    withRegistry([{ id: "RFC-13", kind: "rfc", state: {} }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-13", { setAttr }, { id: "RFC-13" });
    fireEvent.click(await screen.findByRole("button", { name: "retired" }));
    fireEvent.click(screen.getByRole("button", { name: "cancelled" }));
    expect(setAttr).toHaveBeenCalledTimes(1);
    const [, pairs] = setAttr.mock.calls[0];
    expect(pairs.retired).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pairs.retiredAs).toBe("cancelled");
  });

  it("c7 · superseded with nothing named asks what replaced it, and writes nothing", async () => {
    withRegistry([{ id: "RFC-14", kind: "rfc", state: {} }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-14", { setAttr }, { id: "RFC-14" });
    fireEvent.click(await screen.findByRole("button", { name: "retired" }));
    fireEvent.click(screen.getByRole("button", { name: "superseded" }));
    expect(setAttr).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/superseded by what/i);
  });

  it("c7 · name the document and the pointer lands on the leaf's own line", async () => {
    withRegistry([{ id: "RFC-15", kind: "rfc", state: {} }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-15", { setAttr }, { id: "RFC-15" });
    fireEvent.click(await screen.findByRole("button", { name: "retired" }));
    // The pointer field is SUMMONED by the reason that needs it — pressing superseded with no
    // document named opens the field instead of writing (his, 2026-10-29: a standing field beside
    // every reason read as a mystery).
    fireEvent.click(screen.getByRole("button", { name: "superseded" }));
    fireEvent.change(screen.getByLabelText("superseded by"), { target: { value: "RFC-081" } });
    fireEvent.click(screen.getByRole("button", { name: "superseded" }));
    const [line, pairs] = setAttr.mock.calls[0];
    expect(line).toBe(3); // the leaf's line — the document's own first line, not a side table
    expect(pairs.retiredAs).toBe("superseded");
    expect(pairs.supersededBy).toBe("RFC-081");
  });

  // Backing out has to be possible, or the menu is a trap: pressing retire would commit you to
  // retiring something the moment you wanted to look at the words.
  it("never mind closes the menu and writes nothing", async () => {
    withRegistry([{ id: "RFC-16", kind: "rfc", state: {} }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-16", { setAttr }, { id: "RFC-16" });
    fireEvent.click(await screen.findByRole("button", { name: "retired" }));
    fireEvent.click(screen.getByRole("button", { name: "never mind" }));
    expect(screen.queryByRole("group", { name: /why is this being retired/i })).toBeNull();
    expect(setAttr).not.toHaveBeenCalled();
  });

  // Every kind, because the gate used to be per-kind and the menu must not be.
  it("a gap and an arc both get the menu, from their own first state", async () => {
    withRegistry([{ id: "G-12", kind: "gap", state: {} }]);
    mountWritable("gap", "G-12", { setAttr: jest.fn() }, { id: "G-12" });
    fireEvent.click(await screen.findByRole("button", { name: "retired" }));
    expect(screen.getByRole("button", { name: "cancelled" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "shelf" })).toBeTruthy();
  });
});

// ─── RFC-076 §4.5 — THE GAP'S FORK AND ITS PROOF, AT THE CONTROL ───────────────────────────────

describe("a gap's two endings, under your finger", () => {
  it("from open, both endings are offered — the fork is a press, not a hidden path", async () => {
    withRegistry([{ id: "G-1", kind: "gap", state: {} }]);
    mountWritable("gap", "G-1", { setAttr: jest.fn() }, { id: "G-1" });
    expect(await screen.findByRole("button", { name: "resolved" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "rejected" })).toBeTruthy();
  });

  // c18 · THE REFUSAL THAT IS A STEP. Pressing resolved on a gap with no evidence must not just
  // say no — it offers the block, because the gap is one block away from being true.
  it("c18 · pressing resolved with no proof offers to attach one instead of refusing", async () => {
    withRegistry([{ id: "G-2", kind: "gap", state: {} }]);
    const setAttr = jest.fn();
    const appendEnd = jest.fn();
    mountWritable("gap", "G-2", { setAttr, appendEnd }, { id: "G-2" });
    fireEvent.click(await screen.findByRole("button", { name: "resolved" }));
    expect(setAttr).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/evidence, not by saying so/);
    const offer = screen.getByRole("button", { name: "add a proof block" });
    fireEvent.click(offer);
    expect(appendEnd).toHaveBeenCalledWith(expect.stringContaining(":::cmd"));
  });

  it("with a proof on the row, the same press writes resolved=", async () => {
    withRegistry([{ id: "G-3", kind: "gap", state: { hasProof: true } }]);
    const setAttr = jest.fn();
    mountWritable("gap", "G-3", { setAttr }, { id: "G-3" });
    fireEvent.click(await screen.findByRole("button", { name: "resolved" }));
    const [, pairs] = setAttr.mock.calls[0];
    expect(pairs.resolved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("pressing rejected asks why, and writes nothing until it is answered", async () => {
    withRegistry([{ id: "G-4", kind: "gap", state: {} }]);
    const setAttr = jest.fn();
    mountWritable("gap", "G-4", { setAttr }, { id: "G-4" });
    fireEvent.click(await screen.findByRole("button", { name: "rejected" }));
    expect(setAttr).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /why is this being declined/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("why this is declined"), { target: { value: "wontfix" } });
    fireEvent.click(screen.getByRole("button", { name: "decline it" }));
    const [, pairs] = setAttr.mock.calls[0];
    expect(pairs.rejected).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pairs.why).toBe("wontfix");
    expect(pairs.resolved).toBe(null); // the fork — it cannot read as both
  });

  // An RFC's rejection is its approval block's verdict, so the control must NOT offer a reason
  // field there — that would be an affordance for a write that cannot land.
  it("a rejected RFC's station does not open a reason field", async () => {
    withRegistry([{ id: "RFC-90", kind: "rfc", state: { verdict: "rejected" } }]);
    mountWritable("rfc", "RFC-90", { setAttr: jest.fn() }, { id: "RFC-90" });
    fireEvent.click(await screen.findByRole("button", { name: "rejected" }));
    expect(screen.queryByRole("group", { name: /why is this being declined/i })).toBeNull();
  });

  // The trail stops drawing the road not taken — a resolved gap has no `rejected` station left.
  it("once a gap resolved, the other ending is no longer drawn", async () => {
    withRegistry([{ id: "G-5", kind: "gap", state: { hasProof: true, done: true } }]);
    mountWritable("gap", "G-5", { setAttr: jest.fn() }, { id: "G-5", resolved: "2026-10-28" });
    expect(await screen.findByRole("button", { name: "resolved" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "rejected" })).toBeNull();
  });
});

// c6's document half — a retired leaf with a reason nobody put on the list SAYS so in the render,
// read-only included. It was a hover title only the editable render carried, which is a surface
// keeping a fact to itself; the drawer said it and the document did not.
describe("an unreadable retirement reason is said in the document", () => {
  // The leaf is authoritative for the stations it declares, so the fixture carries the real
  // document shape: `retired=` on the leaf, the reason on the row.
  const mountReadOnly = (id, state, attrs) =>
    render(
      <MarkdownMembersProvider value={{ projectCode: "systemview-test", source: "" }}>
        <LifecycleTrail kind="rfc" id={id} attrs={attrs} />
      </MarkdownMembersProvider>,
    );
  it("renders the line visibly on a read-only trail", async () => {
    withRegistry([{ id: "RFC-80", kind: "rfc", state: { verdict: "approved", retired: true, retiredAs: "binned" } }]);
    mountReadOnly("RFC-80", null, { retired: "2026-10-28" });
    expect(await screen.findByRole("note")).toHaveTextContent(/binned — not a reason anything can read/);
  });
  it("and says nothing when the reason is on the list", async () => {
    withRegistry([{ id: "RFC-81", kind: "rfc", state: { verdict: "approved", retired: true, retiredAs: "shelf" } }]);
    mountReadOnly("RFC-81", null, { retired: "2026-10-28" });
    await screen.findByText("retired");
    expect(screen.queryByRole("note")).toBeNull();
  });
});
