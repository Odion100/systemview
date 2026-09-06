import React from "react";
import { render, screen } from "@testing-library/react";
import { MarkdownCapabilitiesProvider, useCapability, useCapabilityState, DENIED } from "./capabilities";

// RFC-053 — a block is a capability, and the HOST says which ones exist. The three states have to
// stay distinguishable, because "the browser can't do this" and "you can't do this here" are
// opposite sentences that would otherwise render as the same grey box.
const Probe = ({ name }) => {
  const impl = useCapability(name);
  return (
    <span>
      {useCapabilityState(name)}:{impl ? "usable" : "none"}
    </span>
  );
};
const withBag = (bag, name) =>
  render(
    <MarkdownCapabilitiesProvider value={bag}>
      <Probe name={name} />
    </MarkdownCapabilitiesProvider>,
  );

describe("what a host grants the markdown vocabulary", () => {
  it("grants a capability the host implements", () => {
    withBag({ files: () => ({ readFile: () => {} }) }, "files");
    expect(screen.getByText("granted:usable")).toBeTruthy();
  });

  it("reports a capability the host never wired as ABSENT — not denied", () => {
    withBag({ files: () => ({}) }, "git");
    expect(screen.getByText("absent:none")).toBeTruthy();
  });

  it("reports a capability the host explicitly withholds as DENIED", () => {
    withBag({ files: () => ({}), git: DENIED }, "git");
    expect(screen.getByText("denied:none")).toBeTruthy();
  });

  // A denied capability must never be callable — the block asking "can I act?" gets one answer for
  // both refusals, so no block can accidentally act on a withheld one.
  it("hands back nothing to act with in either refusal", () => {
    withBag({ git: DENIED }, "git");
    expect(screen.queryByText(/usable/)).toBe(null);
  });

  it("grants nothing at all with no provider above it", () => {
    render(<Probe name="files" />);
    expect(screen.getByText("absent:none")).toBeTruthy();
  });
});
