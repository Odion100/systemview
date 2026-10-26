import React from "react";
import { render, screen } from "@testing-library/react";
import { stateOf, LifecycleTrail } from "./lifecycle";
import { MarkdownMembersProvider } from "../context";
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
