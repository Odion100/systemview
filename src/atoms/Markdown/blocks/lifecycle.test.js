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
    expect(stateOf("rfc", { state: { built: true, settled: true } })).toBe("settled");
    expect(stateOf("rfc", { state: { built: true, retired: true } })).toBe("retired");
    expect(stateOf("rfc", { state: { verdict: "rejected" } })).toBe("rejected");
  });
  it("arc, gap and report each speak their own", () => {
    expect(stateOf("arc", { state: { done: true } })).toBe("done");
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
    expect(built.className).toContain("md-arc__station--now");
    expect(screen.getByText("draft").className).toContain("md-arc__station--past");
    expect(screen.getByText("retired").className).not.toContain("--now");
  });

  it("no registry row → no trail at all; the leaf stays the label it was", async () => {
    withRegistry([{ id: "RFC-999", state: {} }]);
    const { container } = mount("rfc", "RFC-073");
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector(".md-arc__life")).toBeNull();
  });

  it("no hub at all → nothing, no error", async () => {
    const { container } = mount("rfc", "RFC-073");
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector(".md-arc__life")).toBeNull();
  });

  it("a rejected RFC shows its real ending — draft → rejected, nothing after", async () => {
    withRegistry([{ id: "RFC-050", state: { verdict: "rejected" } }]);
    mount("rfc", "RFC-050");
    const dead = await screen.findByText("rejected");
    expect(dead.className).toContain("md-arc__station--dead");
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
    withRegistry([{ id: "RFC-2", kind: "rfc", state: { built: true, settled: true } }]);
    const setAttr = jest.fn();
    mountWritable("rfc", "RFC-2", { setAttr }, { id: "RFC-2", settled: "2026-10-27" });
    fireEvent.click(await screen.findByRole("button", { name: "built" }));
    expect(setAttr.mock.calls[0][1]).toEqual({ settled: null, retired: null });
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
    expect(await screen.findByRole("status")).toHaveTextContent(/approval block's verdict/);
  });

  it("an arc's done is refused — it comes from the objectives", async () => {
    withRegistry([{ id: "ARC-9", kind: "arc", state: { done: false } }]);
    const setAttr = jest.fn();
    mountWritable("arc", "ARC-9", { setAttr });
    fireEvent.click(await screen.findByRole("button", { name: "done" }));
    expect(setAttr).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/objective/);
  });

  // A READ-ONLY SURFACE STAYS A READ. No buttons at all where there is nothing to save to.
  it("draws plain text, not controls, where the document cannot be written", async () => {
    withRegistry([{ id: "RFC-5", kind: "rfc", state: { built: true } }]);
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
    expect(built.className).toMatch(/md-arc__station--now/);
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
