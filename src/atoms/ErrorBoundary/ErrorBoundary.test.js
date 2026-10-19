import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

// HIS CARD, found by use twice in one evening (2026-10-19): *"a failed panel should go grey and say
// so while the rest stands."* Until this existed there was not one `componentDidCatch` in the
// window, so a tooltip reading a field on a card with no account unmounted the chat, the tabs and
// the navigator — everything.
//
// React prints the caught error to the console by design, so these tests silence it: the noise is
// expected here and reading it as a failure would train everyone to ignore the suite's output.
const Boom = ({ when = true }) => {
  if (when) throw new Error("c.status.by is undefined");
  return <div>the panel</div>;
};

let quiet;
beforeEach(() => {
  quiet = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => quiet.mockRestore());

describe("a contained crash", () => {
  it("renders its children untouched when nothing throws", () => {
    render(
      <ErrorBoundary label="The board">
        <Boom when={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("the panel")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("catches the throw and NAMES what stopped, rather than taking the tree down", () => {
    render(
      <ErrorBoundary label="The board">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("The board stopped")).toBeTruthy();
  });

  // "Something went wrong" tells him nothing the grey box did not. The message is the one thing
  // that makes a contained crash diagnosable without devtools.
  it("shows the error's own message", () => {
    render(
      <ErrorBoundary label="The board">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("c.status.by is undefined")).toBeTruthy();
  });

  // Containing is not swallowing — the stack still reaches the console exactly as React would send
  // it, or a contained crash becomes an invisible one.
  it("still reports the crash to the console", () => {
    render(
      <ErrorBoundary label="The board">
        <Boom />
      </ErrorBoundary>,
    );
    const ours = quiet.mock.calls.filter((c) => String(c[0]).includes("[The board] crashed and was contained"));
    expect(ours.length).toBe(1);
  });

  it("hands the error to an onError hook when one is given", () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary label="The board" onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalled();
    expect(String(onError.mock.calls[0][0].message)).toContain("c.status.by");
  });

  // RETRY IS A REMOUNT. Re-rendering the same instance hands the crashed child its own state back
  // and it throws again on the spot; bumping the key throws the subtree away first.
  it("retry re-mounts the subtree, so a panel that is fine now comes back", () => {
    const Flaky = (() => {
      let first = true;
      return () => {
        if (first) {
          first = false;
          throw new Error("once");
        }
        return <div>recovered</div>;
      };
    })();
    render(
      <ErrorBoundary label="The board">
        <Flaky />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText("try again"));
    expect(screen.getByText("recovered")).toBeTruthy();
  });

  // In a document a failed block is ONE LINE where the block would have been — a panel-sized
  // notice in the middle of prose is a second kind of damage.
  it("is one quiet line inside a document, not a panel", () => {
    const { container } = render(
      <ErrorBoundary label="The chart block" quiet>
        <Boom />
      </ErrorBoundary>,
    );
    expect(container.querySelector(".sv-boundary--quiet")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/could not be drawn/)).toBeTruthy();
  });
});
