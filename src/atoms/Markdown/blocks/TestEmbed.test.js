import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestEmbed from "./TestEmbed";
import ServiceContext from "../../../ServiceContext";
import { MarkdownScopeProvider } from "../context";

// A DEAD EMBED TELLS THE AGENT THAT WROTE IT. `::test` with a target that does not parse — or no
// project to resolve it against — renders "no test named" to the reader; these pin that the WRITER
// hears it too, through the same once-only hook every resolving block now carries. The hook's own
// rules (audience, dedupe, the address requirement) live in blockFailure.test.js; here it is a spy.
const mockReported = jest.fn();
jest.mock("../blockFailure", () => ({ useBlockFailure: () => mockReported }));
// CRA resets mock implementations before every test (resetMocks: true), so the promise the
// blocks .catch() on is re-armed here rather than at the declaration.
beforeEach(() => mockReported.mockResolvedValue(null));

const mount = (ui, { scope = {}, services = [] } = {}) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <ServiceContext.Provider value={{ connectedServices: services }}>
        <MarkdownScopeProvider value={scope}>{ui}</MarkdownScopeProvider>
      </ServiceContext.Provider>
    </MemoryRouter>
  );

describe("::test — a dead embed tells its writer", () => {
  beforeEach(() => mockReported.mockClear());

  it("reports a target that does not parse", () => {
    mount(<TestEmbed label="" attrs={{}} />, { scope: { projectCode: "systemview" } });
    expect(screen.getByText("::test — no test named")).toBeTruthy();
    expect(mockReported).toHaveBeenCalledWith({
      kind: "test",
      ref: "",
      reason: "no test named — the target did not parse",
    });
  });

  it("reports a target with no project in scope to resolve it against", () => {
    mount(<TestEmbed label="Math.add" attrs={{}} />, { scope: {} });
    expect(screen.getByText("::test — no test named")).toBeTruthy();
    expect(mockReported).toHaveBeenCalledWith({
      kind: "test",
      ref: "Math.add",
      reason: "no project in scope to resolve it against",
    });
  });

  it("reports nothing about an embed that resolves", () => {
    mount(<TestEmbed label="TestService.Math.add" attrs={{}} />, { scope: { projectCode: "systemview" } });
    expect(screen.queryByText("::test — no test named")).toBeNull();
    expect(mockReported).not.toHaveBeenCalled();
  });
});
