import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Decision from "./Decision";
import Decisions from "./Decisions";
import { MarkdownWriteProvider, MarkdownMembersProvider } from "../context";

// A DECISION IS A RECORD, NOT AN APPROVAL — his, 2026-11-12: *"making a decision doesn't mean you
// have the approval. And when you think about it in an organization, it's different."* These
// assertions are about that difference holding on the surface, not only in the parser.

const one = ({ attrs = {}, editable = true, label = "host or sender?" } = {}) => {
  const setAttr = jest.fn();
  render(
    <MarkdownWriteProvider value={{ editable, setAttr }}>
      <Decision attrs={attrs} label={label} line={12} />
    </MarkdownWriteProvider>,
  );
  return { setAttr };
};

const roll = (source) =>
  render(
    <MarkdownMembersProvider value={{ source }}>
      <Decisions />
    </MarkdownMembersProvider>,
  );

describe("the decision card", () => {
  it("names itself, so a card with an id and a state cannot be mistaken for something else", () => {
    one();
    expect(screen.getByText("decision")).toBeInTheDocument();
  });

  it("shows the QUESTION and says nothing has been chosen while it is open", () => {
    one();
    expect(screen.getByText("host or sender?")).toBeInTheDocument();
    expect(screen.getByText(/nothing chosen yet/i)).toBeInTheDocument();
  });

  it("KEEPS the question after the choice lands, beside what was chosen", () => {
    one({ attrs: { state: "decided", chose: "the host's machine" } });
    expect(screen.getByText("host or sender?")).toBeInTheDocument();
    expect(screen.getByText("the host's machine")).toBeInTheDocument();
  });

  it("shows the road NOT taken, which is the half a rewritten section destroys", () => {
    one({ attrs: { state: "decided", chose: "the host", over: "the sender|a relay in the middle" } });
    expect(screen.getByText("the sender")).toBeInTheDocument();
    expect(screen.getByText("a relay in the middle")).toBeInTheDocument();
  });

  it("says DECIDED, NOT APPROVED when a ratifier has not signed — the state an approval cannot express", () => {
    one({ attrs: { state: "decided", chose: "the host", ratify: "autobot" } });
    expect(screen.getByText(/decided, not approved/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting autobot/i)).toBeInTheDocument();
  });

  it("asks for nothing when nobody was named to ratify — a decision is not pending by default", () => {
    one({ attrs: { state: "decided", chose: "the host" } });
    expect(screen.queryByText(/not approved/i)).toBeNull();
    expect(screen.queryByText(/awaiting/i)).toBeNull();
  });

  it("says so when it was ratified, rather than going silent", () => {
    one({ attrs: { state: "decided", chose: "the host", ratify: "autobot", approved: "autobot" } });
    expect(screen.getByText(/ratified by autobot/i)).toBeInTheDocument();
  });

  it("calls out a decision recorded with nothing chosen", () => {
    one({ attrs: { state: "decided" } });
    expect(screen.getByText(/nobody wrote down what was chosen/i)).toBeInTheDocument();
  });

  it("says a reversal is what WAS decided, not what stands", () => {
    one({ attrs: { state: "reversed", chose: "the sender" } });
    expect(screen.getByText(/not what stands/i)).toBeInTheDocument();
  });

  it("shows who OWES an open one", () => {
    one({ attrs: { owner: "you" } });
    expect(screen.getByText(/you to decide/i)).toBeInTheDocument();
  });

  it("shows who MADE a decided one — a different fact from who owed it", () => {
    one({ attrs: { owner: "you", state: "decided", chose: "the host", by: "systemview-test" } });
    expect(screen.getByText(/by systemview-test/i)).toBeInTheDocument();
    expect(screen.queryByText(/to decide/i)).toBeNull();
  });

  it("stamps the clock WITH the state in one write, because a record with no when ages badly", () => {
    const { setAttr } = one();
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(setAttr).toHaveBeenCalledTimes(1);
    const [line, pairs] = setAttr.mock.calls[0];
    expect(line).toBe(12);
    expect(pairs.state).toBe("decided");
    expect(Number(pairs.at)).toBeGreaterThan(0);
  });

  it("presses from decided to reversed, and does NOT re-stamp the clock doing it", () => {
    const { setAttr } = one({ attrs: { state: "decided", chose: "host", at: "1700000000000" } });
    fireEvent.click(screen.getByRole("button", { name: "decided" }));
    expect(setAttr.mock.calls[0][1]).toEqual({ state: "reversed" });
  });

  it("writes nothing where the surface cannot save", () => {
    const { setAttr } = one({ editable: false });
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(setAttr).not.toHaveBeenCalled();
  });
});

describe("the ::decisions roll-up", () => {
  it("states absence rather than rendering a blank", () => {
    roll("# a plan with no forks named yet");
    expect(screen.getByText(/none recorded in this document yet/i)).toBeInTheDocument();
  });

  it("derives every count off the blocks, awaiting separately from open", () => {
    roll(
      [
        "::decision[a]{id=d1 owner=you}",
        "::decision[b]{id=d2 state=decided chose=left}",
        "::decision[c]{id=d3 state=decided chose=right ratify=autobot}",
      ].join("\n"),
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2 decided")).toBeInTheDocument();
    expect(screen.getByText("1 open")).toBeInTheDocument();
    expect(screen.getByText("1 awaiting approval")).toBeInTheDocument();
  });

  // His, 2026-11-12: "just like claims, a planning report has decisions… you can add a progress bar
  // there." And then, after I copied the claims ledger wholesale: *"it had its own look and with
  // slight modification it could have showed progress too. You went and copied."* So the bar is
  // THIS block's — segments in the colours of the chips below it, which are its own vocabulary —
  // and these assertions pin that it is not wearing `pl`.
  it("carries a progress bar made of its OWN chips, not the claims ledger", () => {
    const { container } = roll(
      [
        "::decision[a]{id=d1 state=decided chose=x}",
        '::decision[b]{id=d2 state=open chose="said, not closed"}',
        "::decision[c]{id=d3}",
        "::decision[d]{id=d4}",
      ].join("\n"),
    );
    expect(container.querySelector(".pl__bar")).toBeNull();
    const bar = container.querySelector(".md-decisions__bar");
    expect(bar).toBeTruthy();
    // 1 of 4 closed, 1 of 4 answered-not-closed — two separate segments, never summed into one
    expect(bar.querySelector(".is-decided").style.width).toBe("25%");
    expect(bar.querySelector(".is-answered").style.width).toBe("25%");
    expect(screen.getByText("1 answered, not closed")).toBeInTheDocument();
  });

  it("leaves OPEN as the empty remainder of the track, never as a segment", () => {
    const { container } = roll(["::decision[a]{id=d1 state=decided chose=x}", "::decision[b]{id=d2}"].join("\n"));
    const bar = container.querySelector(".md-decisions__bar");
    expect(bar.querySelector(".is-decided").style.width).toBe("50%");
    expect(bar.querySelector(".is-open")).toBeNull();
  });

  it("gives a REVERSED decision its own segment, because it is not progress", () => {
    const { container } = roll(["::decision[a]{id=d1 state=decided chose=x}", "::decision[b]{id=d2 state=reversed chose=y}"].join("\n"));
    const bar = container.querySelector(".md-decisions__bar");
    expect(bar.querySelector(".is-reversed").style.width).toBe("50%");
    expect(screen.getByText("1 reversed")).toBeInTheDocument();
  });

  it("says WHOSE answer is missing, and keeps the unowned visible", () => {
    roll(["::decision[a]{id=d1 owner=you}", "::decision[b]{id=d2}"].join("\n"));
    expect(screen.getByText("you")).toBeInTheDocument();
    expect(screen.getByText("nobody named")).toBeInTheDocument();
    expect(screen.getByText("d1")).toBeInTheDocument();
    expect(screen.getByText("d2")).toBeInTheDocument();
  });
});
