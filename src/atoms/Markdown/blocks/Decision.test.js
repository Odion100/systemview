import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FLASH_CLASS } from "../revealBlock";
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

  // His, 2026-11-12: "I think you should be able to click one of those and then bring you right to
  // the block. It becomes an easy communication method when we're talking in a conversation."
  it("PRESSES through to the block — the id is an address, not a label", () => {
    const src = ["::decision[a]{id=d1 owner=you}", "", "::decision[b]{id=d2 owner=you}"].join("\n");
    const { container } = render(
      <div className="markdown">
        <MarkdownMembersProvider value={{ source: src }}>
          <Decisions />
        </MarkdownMembersProvider>
        <div data-md-start="1" id="one" />
        <div data-md-start="3" id="two" />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "d2" }));
    expect(container.querySelector("#two").className).toContain(FLASH_CLASS);
    expect(container.querySelector("#one").className).not.toContain(FLASH_CLASS);
  });

  it("does nothing rather than throwing when the document on screen is not this one", () => {
    render(
      <div className="markdown">
        <MarkdownMembersProvider value={{ source: "::decision[a]{id=d1 owner=you}" }}>
          <Decisions />
        </MarkdownMembersProvider>
      </div>,
    );
    expect(() => fireEvent.click(screen.getByRole("button", { name: "d1" }))).not.toThrow();
  });

  // WHICH ONES ARE SETTLED — his ask, and colour on the owed line could never have answered it:
  // everything there is open by definition, so it would be one hue repeated.
  it("shows a coloured chip per ACTED-ON decision, wearing its state", () => {
    const { container } = roll(
      [
        "::decision[a]{id=d1 owner=you}",
        "::decision[b]{id=d2 state=decided chose=X}",
        "::decision[c]{id=d3 state=reversed chose=Y}",
        "::decision[d]{id=d4 state=decided chose=Z ratify=him}",
        "::decision[e]{id=d5 state=decided}",
      ].join("\n"),
    );
    const tone = (id) =>
      [...container.querySelectorAll(".md-decisions__owed .md-decisions__id")].find((b) => b.textContent === id).className;
    expect(tone("d2")).toContain("--decided");
    expect(tone("d3")).toContain("--reversed");
    expect(tone("d4")).toContain("--awaiting");
    expect(tone("d5")).toContain("--unsaid");
  });

  // THE PRECEDENCE IS THE POINT, not an implementation detail: a decision carrying a ratification
  // it has not got must not wear the colour of a finished one, and a choice with nothing written
  // down must not either.
  it("awaiting and unsaid outrank plain decided — neither may wear a finished colour", () => {
    const { container } = roll(
      ["::decision[a]{id=d1 state=decided chose=X ratify=him approved=him}", "::decision[b]{id=d2 state=decided chose=X ratify=him}"].join("\n"),
    );
    const tone = (id) =>
      [...container.querySelectorAll(".md-decisions__owed .md-decisions__id")].find((b) => b.textContent === id).className;
    expect(tone("d1")).toContain("--decided");
    expect(tone("d2")).toContain("--awaiting");
  });

  // ONE LIST, GROUPED BY PERSON, AND THE COLOUR SEPARATES THEM. Two earlier shapes were wrong in
  // opposite directions: colouring only the open ones said nothing (they are all one state), and
  // putting the acted-on ones in their own row under the bar read as a second unrelated section.
  it("every decision is in the list, under the person it belongs to", () => {
    const { container } = roll(
      [
        "::decision[a]{id=d1 owner=you}",
        "::decision[b]{id=d2 state=decided chose=X by=you}",
        "::decision[c]{id=d3 state=decided chose=Y by=buapi}",
        "::decision[d]{id=d4}",
      ].join("\n"),
    );
    const groups = [...container.querySelectorAll(".md-decisions__owes")].map((g) => [
      g.querySelector(".md-decisions__who").textContent,
      [...g.querySelectorAll(".md-decisions__id")].map((b) => b.textContent),
    ]);
    expect(groups).toEqual([["you", ["d1", "d2"]], ["buapi", ["d3"]], ["nobody named", ["d4"]]]);
  });

  // WHICH PERSON DEPENDS ON THE STATE, and that is why there are two attributes: `owner` owes the
  // answer while the fork is open, `by` made the call once it closed. A decision taken by somebody
  // it was not assigned to is exactly what an organization's record has to be able to show.
  it("an open decision sits with who OWES it, a closed one with who MADE it", () => {
    const { container } = roll(
      ["::decision[a]{id=d1 owner=you by=buapi}", "::decision[b]{id=d2 state=decided chose=X owner=you by=buapi}"].join("\n"),
    );
    const of = (who) =>
      [...container.querySelectorAll(".md-decisions__owes")]
        .find((g) => g.querySelector(".md-decisions__who").textContent === who);
    expect([...of("you").querySelectorAll(".md-decisions__id")].map((b) => b.textContent)).toEqual(["d1"]);
    expect([...of("buapi").querySelectorAll(".md-decisions__id")].map((b) => b.textContent)).toEqual(["d2"]);
  });

  it("each id wears its state, and open comes first inside a group", () => {
    const { container } = roll(
      [
        "::decision[a]{id=d1 state=decided chose=X by=you}",
        "::decision[b]{id=d2 owner=you}",
        "::decision[c]{id=d3 state=decided chose=Y by=you ratify=him}",
      ].join("\n"),
    );
    const ids = [...container.querySelectorAll(".md-decisions__owed .md-decisions__id")];
    expect(ids.map((b) => b.textContent)).toEqual(["d2", "d1", "d3"]);
    expect(ids.map((b) => (b.className.match(/--(\w+)/) || [])[1])).toEqual(["open", "decided", "awaiting"]);
  });

  it("…and appears exactly once — no id is rendered in two places", () => {
    const { container } = roll(["::decision[a]{id=d1 owner=you}", "::decision[b]{id=d2 state=decided chose=X by=you}"].join("\n"));
    const shown = [...container.querySelectorAll(".md-decisions__id")].map((b) => b.textContent);
    expect(shown).toEqual(["d1", "d2"]);
    expect(new Set(shown).size).toBe(shown.length);
  });

  it("the unowned group is kept, and goes last — nothing will ever chase those", () => {
    const { container } = roll(["::decision[a]{id=d1}", "::decision[b]{id=d2 owner=you}"].join("\n"));
    const names = [...container.querySelectorAll(".md-decisions__who")].map((n) => n.textContent);
    expect(names).toEqual(["you", "nobody named"]);
  });

});
