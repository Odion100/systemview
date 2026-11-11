import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Claim from "./Claim";
import Claims from "./Claims";
import { MarkdownWriteProvider, MarkdownMembersProvider } from "../context";

// AN UNPROVED MARK TELLS ITS MAKER — the wiring claim; the hook's own rules live in
// blockFailure.test.js, so here it is a spy.
const mockReported = jest.fn();
jest.mock("../blockFailure", () => ({ useBlockFailure: () => mockReported }));
// CRA resets mock implementations before every test (resetMocks: true), so the promise the
// blocks .catch() on is re-armed here rather than at the declaration.
beforeEach(() => mockReported.mockResolvedValue(null));

// THE RULE THESE GUARD: his press is its own evidence and writes at once; a note is optional and
// lands as its own write. (The statement rule binds an AGENT's mark — that is in the chapter, not
// in the block, because a file write cannot be policed here.) Mountable because the
// block imports no markdown renderer (the same reason Members has tests and Markdown.js does not).

const SOURCE = [
  "::claims",
  "::claim[Open the list → rows show when parsed]{id=c1}",
  "::claim[Approve it → the count drops]{id=c2 state=met by=you at=1792956000000 note=\"went 4 to 3\"}",
].join("\n");

const mount = ({ attrs = { id: "c1" }, label = "Open the list → rows show when parsed", line = 2, editable = true } = {}) => {
  const setAttr = jest.fn();
  render(
    <MarkdownMembersProvider value={{ source: SOURCE }}>
      <MarkdownWriteProvider value={{ editable, setAttr }}>
        <Claim attrs={attrs} label={label} line={line} />
      </MarkdownWriteProvider>
    </MarkdownMembersProvider>,
  );
  return { setAttr };
};

describe("::claim — the statement, named by its id", () => {
  it("shows the statement, the claim's OWN id, and reads unchecked until marked", () => {
    mount();
    expect(screen.getByText("Open the list → rows show when parsed")).toBeTruthy();
    expect(screen.getByText("c1")).toBeTruthy();
    expect(screen.getByText("unchecked")).toBeTruthy();
  });

  // THE BUG THIS REPLACED: the row rendered its ORDINAL, so a document that inserts an id — and
  // RFC-075 inserts c14b — labelled every row after it with a number that was not its name. Row 15
  // was c14b, row 16 was c15, row 21 was c20. Claims are said out loud by id, so the window was
  // answering a different question from the one being asked, and agreed for fourteen rows first.
  it("a NON-SEQUENTIAL id wins over the position — the c14b case that caused this", () => {
    const source = [
      "::claim[one]{id=c14}",
      "::claim[the inserted one]{id=c14b}",
      "::claim[after it]{id=c15}",
    ].join("\n");
    render(
      <MarkdownMembersProvider value={{ source }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
          <Claim attrs={{ id: "c14b" }} label="the inserted one" line={2} />
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );
    expect(screen.getByText("c14b")).toBeTruthy();
    // its POSITION is 2 — the thing that used to be shown, and is not the row's name
    expect(screen.queryByText("2")).toBeNull();
  });

  it("no id= falls back to the position, because that is all there is to show", () => {
    const source = ["::claim[first]", "::claim[second]"].join("\n");
    render(
      <MarkdownMembersProvider value={{ source }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
          <Claim attrs={{}} label="second" line={2} />
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("a marked claim shows who, and the statement the mark carries", () => {
    mount({ attrs: { id: "c2", state: "met", by: "you", at: "1792956000000", note: "went 4 to 3" }, label: "Approve it → the count drops", line: 3 });
    expect(screen.getByText("met")).toBeTruthy();
    expect(screen.getByText(/✓ you/)).toBeTruthy();
    expect(screen.getByText("went 4 to 3")).toBeTruthy();
    expect(screen.getByText("c2")).toBeTruthy();
  });
});

describe("the press — his press is the evidence; the note is optional", () => {
  it("pressing ✓ writes state, by=you and at at once — a signature, never a note (there is no note UI)", () => {
    const { setAttr } = mount();
    fireEvent.click(screen.getByTitle("Met — writes into the document"));
    expect(setAttr).toHaveBeenCalledTimes(1);
    const [line, pairs] = setAttr.mock.calls[0];
    expect(line).toBe(2);
    expect(pairs).toMatchObject({ state: "met", by: "you" });
    expect("note" in pairs).toBe(false); // a press never touches the words
    expect(typeof pairs.at).toBe("number");
    expect(screen.getByText("met")).toBeTruthy();
    expect(screen.queryByText(/what you saw/)).toBeNull();
  });

  it("not met writes unmet under your name, and asks for no essay", () => {
    const { setAttr } = mount();
    fireEvent.click(screen.getByTitle("Not met — writes into the document"));
    expect(setAttr.mock.calls[0][1]).toMatchObject({ state: "unmet", by: "you" });
    expect(screen.queryByText(/what happens instead/)).toBeNull();
  });

  it("the badge stays in the ROW (his call); the stamp carries only the signature chips", () => {
    mount({ attrs: { id: "c2", state: "met", by: "systemview-test|you", at: "1", note: "saw it" }, label: "x", line: 3 });
    const row = document.querySelector(".md-claim__row");
    expect(row.querySelector(".md-claim__state")).toBeTruthy();
    const stamp = document.querySelector(".md-claim__stamp");
    expect(stamp.querySelector(".md-claim__state")).toBeNull();
    expect([...stamp.children][0].className.split(" ")[0]).toBe("md-claim__signer");
    expect(document.querySelectorAll(".md-claim__state")).toHaveLength(1);
  });

  // RFC-075 round two — the claim knows its reviewers, and the badges are the review surface.
  it("the badge grammar — a dashed ✓ is the invitation, a fill is the signature", () => {
    mount({ attrs: { id: "c2", state: "met", by: "systemview-test", at: "1", reviewers: "buapi|systemview-test" }, label: "x", line: 3 });
    expect(screen.getByText("✓ buapi").className).toContain("--invite"); // named, hasn't checked
    expect(screen.getByText("✓ systemview-test").className).toContain("--signed"); // checked — filled
    expect(document.querySelectorAll(".md-claim__signer--signed")).toHaveLength(1);
  });

  it("your badge is always offered — a dashed invite on an unchecked claim; pressing it checks it met and fills", () => {
    const { setAttr } = mount();
    const you = screen.getByTitle("Check it met — writes into the document");
    expect(you.tagName).toBe("BUTTON");
    expect(you.className).toContain("--invite");
    fireEvent.click(you);
    expect(setAttr.mock.calls[0][1]).toMatchObject({ state: "met", by: "you" });
    expect(screen.getByText("✓ you").className).toContain("--signed");
  });

  it("pressing your badge on a claim an agent marked met countersigns the standing state", () => {
    const { setAttr } = mount({ attrs: { id: "c2", state: "met", by: "systemview-test", at: "1" }, label: "x", line: 3 });
    fireEvent.click(screen.getAllByTitle("Agree — adds your signature").find((b) => b.className.includes("signer")));
    expect(setAttr).toHaveBeenCalledWith(3, { by: "systemview-test|you" });
  });

  it("pressing your filled badge steps your signature off — the note untouched", () => {
    const { setAttr } = mount({ attrs: { id: "c2", state: "met", by: "systemview-test|you", at: "1", note: "x" }, label: "x", line: 3 });
    fireEvent.click(screen.getByText("✓ you"));
    expect(setAttr).toHaveBeenCalledWith(3, { by: "systemview-test" });
  });

  it("pressing the mark you already gave takes YOUR signature off — and the note is never erased", () => {
    const { setAttr } = mount({ attrs: { id: "c2", state: "met", by: "you", at: "1", note: "x" }, line: 3 });
    fireEvent.click(screen.getAllByTitle("Take your signature off")[0]); // corner ✓ and your badge both offer it
    expect(setAttr).toHaveBeenCalledWith(3, { state: null, by: null, at: null }); // note NOT in the write
    expect(screen.getByText("unchecked")).toBeTruthy();
  });

  // THE DEFECT THAT TAUGHT THIS: his agreement-press on an agent-marked claim used to mean
  // "withdraw" and wiped the agent's mark and note. A press is a SIGNATURE now.
  it("pressing met on a claim someone ELSE marked met countersigns — by= grows, nothing else moves", () => {
    const { setAttr } = mount({ attrs: { id: "c2", state: "met", by: "systemview-test", at: "1", note: "saw it run" }, line: 3 });
    fireEvent.click(screen.getAllByTitle("Agree — adds your signature")[0]); // corner ✓ and your badge agree alike
    expect(setAttr).toHaveBeenCalledWith(3, { by: "systemview-test|you" });
    expect(screen.getByText(/systemview-test/).className).toContain("md-claim__signer--signed");
    expect(screen.getByText(/✓ you/).className).toContain("md-claim__signer--signed"); // same fill as any signature
    expect(screen.getByText("saw it run")).toBeTruthy();
  });

  it("stepping off a countersigned mark leaves it standing on the other signature", () => {
    const { setAttr } = mount({ attrs: { id: "c2", state: "met", by: "systemview-test|you", at: "1", note: "saw it run" }, line: 3 });
    fireEvent.click(screen.getAllByTitle("Take your signature off")[0]);
    expect(setAttr).toHaveBeenCalledWith(3, { by: "systemview-test" });
    expect(screen.getByText("met")).toBeTruthy();
  });

  it("flipping the state STASHES the outgoing signatures — and keeps the words", () => {
    const { setAttr } = mount({ attrs: { id: "c2", state: "met", by: "systemview-test", at: "1", note: "saw it run" }, line: 3 });
    fireEvent.click(screen.getByTitle("Not met — writes into the document"));
    const pairs = setAttr.mock.calls[0][1];
    expect(pairs).toMatchObject({ state: "unmet", by: "you", metBy: "systemview-test" });
    expect("note" in pairs).toBe(false);
    expect(screen.getByText("saw it run")).toBeTruthy();
    expect(screen.getByText("✗ you")).toBeTruthy(); // on an unmet claim the badge wears the ✗
  });

  // His test, verbatim: "it better come back when I switch to met."
  it("flipping BACK restores the stashed signatures beside yours", () => {
    const { setAttr } = mount({ attrs: { id: "c2", state: "unmet", by: "you", at: "1", metBy: "systemview-test" }, line: 3 });
    fireEvent.click(screen.getByTitle("Met — writes into the document"));
    const pairs = setAttr.mock.calls[0][1];
    expect(pairs).toMatchObject({ state: "met", by: "systemview-test|you", metBy: null });
    expect(screen.getByText("✓ systemview-test").className).toContain("--signed");
  });

  it("read-only surfaces cannot mark, and say so", () => {
    const { setAttr } = mount({ editable: false });
    const btns = screen.getAllByTitle("Read-only here — this surface has nothing to save to");
    expect(btns).toHaveLength(3); // ✓, ✗, and your badge — all say so, none can write
    expect(btns.every((b) => b.disabled)).toBe(true);
    fireEvent.click(btns[0]);
    expect(setAttr).not.toHaveBeenCalled();
  });
});

describe("::claims — all met is a moment, never a silent jump (RFC-075 round two)", () => {
  // ALL MET means marked AND proved — a bare mark is testimony, so the fixture carries the
  // evidence the moment requires: each claim's proof embedded in its own body.
  const ALL_MET = [
    "::claims",
    ":::claim[a]{id=c1 state=met by=you at=1}",
    "::test[Test.Proofs.claimKind]",
    ":::",
    '::::claim[b]{id=c2 state=met by=sv at=1 note="n"}',
    ":::cmd",
    "echo the evidence",
    ":::",
    "::::",
  ].join("\n");

  it("all met but not all reviewed → the tag says review open, and the reviewed count shows", () => {
    render(
      <MarkdownMembersProvider value={{ source: ALL_MET }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn(), appendEnd: jest.fn() }}>
          <Claims />
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );
    expect(screen.getByText("all met — review open")).toBeTruthy();
    expect(screen.getByText(/of 2 reviewed/)).toBeTruthy();
  });

  it("all met with no STATUS → offers the one press that writes the dated heading", () => {
    const appendEnd = jest.fn();
    render(
      <MarkdownMembersProvider value={{ source: ALL_MET }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn(), appendEnd }}>
          <Claims />
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );
    fireEvent.click(screen.getByText("write the STATUS"));
    expect(appendEnd).toHaveBeenCalledTimes(1);
    expect(appendEnd.mock.calls[0][0]).toMatch(/^## STATUS — built \d{4}-\d{2}-\d{2}\n\n::claims$/);
  });

  it("with a STATUS already there, the press is gone — the moment was already closed", () => {
    render(
      <MarkdownMembersProvider value={{ source: ALL_MET + "\n\n## STATUS — built 2026-10-26\n\n::claims" }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn(), appendEnd: jest.fn() }}>
          <Claims />
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );
    // review still open wins the tag's wording even once STATUS exists — his axis, not the file's
    expect(screen.getByText("all met — review open")).toBeTruthy();
    expect(screen.queryByText("write the STATUS")).toBeNull();
  });

  it("not all met → no press, however close the count is", () => {
    render(
      <MarkdownMembersProvider value={{ source: '::claims\n::claim[a]{id=c1 state=met by=you at=1}\n::claim[b]{id=c2}' }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn(), appendEnd: jest.fn() }}>
          <Claims />
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );
    expect(screen.queryByText("write the STATUS")).toBeNull();
  });
});

describe("::claims — the count is derived from the blocks", () => {
  it("counts off the document and never stores a number", () => {
    render(
      <MarkdownMembersProvider value={{ source: SOURCE }}>
        <Claims />
      </MarkdownMembersProvider>,
    );
    // c2 is marked by him and carries nothing — marked is not met, and the LEDGER says which ONE.
    // The old header said "1 marked, unproved" and left you to find it; the row names it now.
    expect(screen.getByText(/of 2 claims/)).toBeTruthy();
    expect(screen.getByText("1 marked, unproved")).toBeTruthy();
    expect(screen.getByText("1 unchecked")).toBeTruthy();
    // the sentence naming WHICH one lives on the claim card now, not in a row under this bar
  });
  it("says there are none rather than drawing 100% of nothing", () => {
    render(
      <MarkdownMembersProvider value={{ source: "# nothing" }}>
        <Claims />
      </MarkdownMembersProvider>,
    );
    expect(screen.getByText("no claims in this document yet")).toBeTruthy();
  });
});

// RFC-075 — the container form: the same claim grown a proof. The children are the PROOF, folded by
// default; the statement rides the opening line (the renderer lifts the label out of the body).
describe(":::claim — the proof, folded", () => {
  const mountProofed = (extra = {}) => {
    const setAttr = jest.fn();
    render(
      <MarkdownMembersProvider value={{ source: ":::claim[Save it → the row re-derives]{id=c1}\nproof body\n:::" }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr }}>
          <Claim kind="container" attrs={{ id: "c1", ...extra }} label="Save it → the row re-derives" line={1}>
            <div data-testid="the-proof">a live cmd block</div>
          </Claim>
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );
    return { setAttr };
  };

  it("renders the statement from the label, the proof folded away under its own header label", () => {
    mountProofed();
    expect(screen.getByText("Save it → the row re-derives")).toBeTruthy();
    expect(screen.getByTestId("the-proof").closest(".md-claim__proof").style.display).toBe("none"); // hidden, never unmounted
    const head = screen.getByText(/▸ proof/);
    expect(head.className).toContain("md-claim__proofhead");
  });

  it("the mark still writes to the OPENING line — a container claim marks exactly as a leaf", () => {
    const { setAttr } = mountProofed();
    fireEvent.click(screen.getByTitle("Met — writes into the document"));
    expect(setAttr.mock.calls[0][0]).toBe(1);
    expect(setAttr.mock.calls[0][1]).toMatchObject({ state: "met", by: "you" });
  });

  it("a leaf claim shows no proof affordance at all", () => {
    mount();
    expect(screen.queryByText(/proof/)).toBeNull();
  });
});

// A CLAIM SAYS WHAT IT OWES. A behavioural claim owes a living spec — a defence the change loop
// runs without anybody remembering to — so one marked met with nothing but a screenshot or a grep
// in its fold must not read identical to a claim something actually defends. An experiential claim
// says what IT is instead: his eye is the instrument, and no spec is owed or possible.
describe("what the claim owes — spec'd, owed, or by eye", () => {
  const DOC = [
    "# RFC-9",                                                               // 1
    "::claim[a leaf nobody can defend]{id=c1 state=met by=sv at=1}",         // 2
    ":::claim[a fold with a saved test]{id=c2 state=met by=sv at=1}",        // 3
    "::test[Math.chainUse]",                                                 // 4
    ":::",                                                                   // 5
    ":::claim[his eye decides]{id=c3 kind=experiential state=met by=you at=1}", // 6
    "::file[RFCs/proofs/badge.png]",                                         // 7
    ":::",                                                                   // 8
    "::claim[nobody looked yet]{id=c4}",                                     // 9
    ":::claim[his eye decides, nothing shown]{id=c5 kind=experiential state=met by=you at=1}", // 10
    ":::",                                                                   // 11
    "::claim[declared behavioural, held]{id=c6 kind=behavioral}",            // 12
    ":::claim[a cmd somebody has to remember to press]{id=c7 state=met by=sv at=1}", // 13
    "::cmd[yarn test]",                                                      // 14
    ":::",                                                                   // 15
  ].join("\n");

  const at = (line, attrs, kind = "leaf") =>
    render(
      <MarkdownMembersProvider value={{ source: DOC }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
          <Claim attrs={attrs} kind={kind} label="x" line={line} />
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );

  it("says `no spec` on a behavioural claim that is marked with nothing the loop runs", () => {
    at(2, { id: "c1", state: "met", by: "sv", at: "1" });
    expect(screen.getByText("no spec")).toBeTruthy();
  });

  it("stays silent when the fold carries a spec — that claim is held", () => {
    at(3, { id: "c2", state: "met", by: "sv", at: "1" }, "container");
    expect(screen.queryByText("no spec")).toBeNull();
  });

  it("says `by eye` on an experiential claim, and never asks it for a spec", () => {
    at(6, { id: "c3", kind: "experiential", state: "met", by: "you", at: "1" }, "container");
    expect(screen.getByText("by eye")).toBeTruthy();
    expect(screen.queryByText("no spec")).toBeNull();
  });

  it("asks nothing of an UNMARKED claim — nobody has concluded anything to defend", () => {
    at(9, { id: "c4" });
    expect(screen.queryByText("no spec")).toBeNull();
    expect(screen.queryByText("by eye")).toBeNull();
  });

  // THE OBLIGATION IS A FIELD, so the claim says which one it is under either way. Before this, only
  // `experiential` drew anything — so a behavioural claim was indistinguishable from one nobody had
  // configured, and the declaration could only be seen when it was VIOLATED (`no spec`).
  it("names the obligation on a behavioural claim, declared or not", () => {
    at(12, { id: "c6", kind: "behavioral" });
    expect(screen.getByText("behavioural")).toBeTruthy();
  });

  it("wears a question mark when nothing was declared — silence READS behavioural, visibly", () => {
    at(9, { id: "c4" });
    expect(screen.getByText("behavioural?")).toBeTruthy();
    expect(screen.queryByText("behavioural")).toBeNull();
  });

  // MARKED IS NOT MET, ON THE DOCUMENT. `metClaims` counts only marked-AND-proved, so a claim
  // marked met with nothing embedded lands in the row's `unproved` — and the document used to look
  // exactly like one that was held. This is the gap closing.
  it("says `unproved` on a claim marked met with no proof embedded", () => {
    at(2, { id: "c1", state: "met", by: "sv", at: "1" });
    expect(screen.getByText("unproved")).toBeTruthy();
  });

  it("and the worst case it was invisible in: experiential, marked met, nothing shown", () => {
    at(10, { id: "c5", kind: "experiential", state: "met", by: "you", at: "1" }, "container");
    expect(screen.getByText("by eye")).toBeTruthy();
    expect(screen.queryByText("no spec")).toBeNull(); // right — no spec is owed
    expect(screen.getByText("unproved")).toBeTruthy(); // but a PROOF was, and nothing was shown
  });

  it("stays silent on a claim that really is held — a fold with a spec", () => {
    at(3, { id: "c2", state: "met", by: "sv", at: "1" }, "container");
    expect(screen.queryByText("unproved")).toBeNull();
  });

  it("and on an experiential claim that shows something — the file IS its proof", () => {
    at(6, { id: "c3", kind: "experiential", state: "met", by: "you", at: "1" }, "container");
    expect(screen.queryByText("unproved")).toBeNull();
  });

  it("never says unproved about a claim nobody marked — there is no claim of met to fail", () => {
    at(9, { id: "c4" });
    expect(screen.queryByText("unproved")).toBeNull();
  });

  // AND THE WRITER HEARS IT — the row said `unproved` to the reader while the agent that made the
  // mark was never told, so it stood until he caught it by eye.
  // AND IT WAITS A BEAT FIRST, because `rfc-execution` prescribes "verify, mark, THEN prove": the
  // mark lands through one door and the fold arrives in a later edit, so EVERY correctly-authored
  // claim passes through marked-and-unproved. Firing instantly nudged the author for following the
  // procedure — measured twice in one session (c33, then c39 on RFC-078), each time describing a
  // gap that was closed minutes before the message landed, and the once-only key means that false
  // nudge is the only one they would ever get about that claim.
  it("reports an unproved mark to the agent that made it — after the grace period", () => {
    jest.useFakeTimers();
    mockReported.mockClear();
    at(2, { id: "c1", state: "met", by: "sv", at: "1" });
    expect(mockReported).not.toHaveBeenCalled(); // not yet — the author may still be embedding it
    act(() => { jest.advanceTimersByTime(60000); });
    // `fault: "state"` is the part that keeps the message true. The composer's default wording
    // opens with "points at "c1" and it does not resolve", and `c1` resolves perfectly — it exists
    // and it is marked. A state fault locates the block and states the whole fact instead.
    expect(mockReported).toHaveBeenCalledWith({
      kind: "claim",
      ref: "c1",
      fault: "state",
      reason: "marked met with no proof embedded — it does not count as met",
    });
    jest.useRealTimers();
  });

  it("the READER is not made to wait — the badge is there immediately", () => {
    jest.useFakeTimers();
    at(2, { id: "c1", state: "met", by: "sv", at: "1" });
    expect(screen.getByText("unproved")).toBeTruthy(); // no timers advanced
    jest.useRealTimers();
  });

  // THE CLEANUP IS THE FIX: embed the fold inside the window and the pending nudge is cleared
  // rather than delivered about a document that is now correct.
  it("says nothing when the fold arrives before the grace period is up", () => {
    jest.useFakeTimers();
    mockReported.mockClear();
    const { unmount } = at(2, { id: "c1", state: "met", by: "sv", at: "1" });
    act(() => { jest.advanceTimersByTime(30000); });
    unmount(); // the proof landed; this claim re-renders held
    act(() => { jest.advanceTimersByTime(60000); });
    expect(mockReported).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("reports nothing about a claim that is actually held", () => {
    mockReported.mockClear();
    at(3, { id: "c2", state: "met", by: "sv", at: "1" }, "container");
    expect(mockReported).not.toHaveBeenCalled();
  });

  // THE EDGE IS WHAT READS FROM ACROSS THE CARD, and the chip was 10px of text beside a full green
  // border. His: *"the border can't be green, but the mark can be checked in green"* — so the card
  // itself carries `unproved`, which is what takes the held colour off the edge while the mark the
  // signature wrote stays exactly as green as it was.
  it("marks the CARD unheld when nothing is embedded, so the edge stops saying held", () => {
    at(2, { id: "c1", state: "met", by: "sv", at: "1" });
    const card = document.querySelector(".md-claim");
    expect(card.className).toContain("md-claim--met");
    expect(card.className).toContain("md-claim--unheld");
  });

  it("and leaves the edge green on a claim the change loop really defends", () => {
    at(3, { id: "c2", state: "met", by: "sv", at: "1" }, "container");
    const card = document.querySelector(".md-claim");
    expect(card.className).toContain("md-claim--met");
    expect(card.className).not.toContain("md-claim--unheld");
  });

  // HELD IS A HIGHER BAR THAN PROVED, and this is the case that forced it. A `:::cmd` counts as
  // PROOF — so the claim is legitimately met and `unproved` never fires — but nothing re-runs it,
  // so the claim is not DEFENDED. It wore a full green edge directly above its own `no spec` chip,
  // on 42 of RFC-076's claims. His: *"as soon as there's a spec, a spec, not a CMD"*.
  it("takes the green off a cmd-proved claim — met, not unproved, and still not held", () => {
    at(13, { id: "c7", state: "met", by: "sv", at: "1" }, "container");
    expect(screen.getByText("no spec")).toBeTruthy();
    expect(screen.queryByText("unproved")).toBeNull(); // a cmd IS proof — this claim is met
    const card = document.querySelector(".md-claim");
    expect(card.className).toContain("md-claim--unheld"); // and it is still not defended
  });

  // An UNMET claim's edge stays red. Amber would downgrade the stronger statement to a debt.
  it("never recolours an unmet claim, however little is behind it", () => {
    at(2, { id: "c1", state: "unmet", by: "sv", at: "1" });
    const card = document.querySelector(".md-claim");
    expect(card.className).toContain("md-claim--unmet");
    expect(card.className).not.toContain("md-claim--unheld");
  });

  // THE TWO KINDS MUST BE TOLD APART AT A SWIPE (his), which a shared class and an opacity could
  // never do: `by eye` carried no modifier at all, so the only difference in the markup was the
  // word. Each kind now names itself, which is what lets the two wear different hues.
  it("gives each kind its own class — the distinction cannot collapse into one look", () => {
    at(6, { id: "c3", kind: "experiential", state: "met", by: "you", at: "1" }, "container");
    expect(document.querySelector(".md-claim__kind--experiential")).toBeTruthy();
    expect(document.querySelector(".md-claim__kind--behavioral")).toBeNull();
  });

  it("and the behavioural one names itself too, declared or not", () => {
    at(12, { id: "c6", kind: "behavioral" });
    expect(document.querySelector(".md-claim__kind--behavioral")).toBeTruthy();
    expect(document.querySelector(".md-claim__kind--experiential")).toBeNull();
  });
});

// RFC-075 c18, the half that was asserted nowhere — the BAR REPORTS the third axis. The arithmetic
// was pinned in claims.test; what a reader actually sees was not, so the claim's own words ("the
// bar reports N/M spec'd and an owed count beside met and reviewed") rode on a count nobody drew.
describe("::claims — the bar reports spec'd and owed, beside met and reviewed", () => {
  const MIXED = [
    "::claims",
    ':::claim[spec\'d]{id=c1 state=met by=you at=1}',
    "::test[Test.Proofs.claimKind]",
    ":::",
    '::claim[marked, nothing behind it]{id=c2 state=met by=you at=1}',
    '::claim[his eye]{id=c3 kind=experiential state=met by=you at=1}',
  ].join("\n");

  it("spec'd counts over the BEHAVIOURAL claims, never the total — and owed names the gap", () => {
    render(
      <MarkdownMembersProvider value={{ source: MIXED }}>
        <Claims />
      </MarkdownMembersProvider>,
    );
    // 2 behavioural (c1, c2), one of them spec'd. Three claims in the document — so "1/3" here
    // would be the bug this assertion exists to catch: an experiential claim is not a shortfall.
    expect(screen.getByText(/of 2 spec/)).toBeTruthy();
    expect(screen.getByText("1 owed")).toBeTruthy();
    // Only c1 carries its proof. c2 is a bare behavioural mark and c3 is experiential with nothing
    // shown — the exemption is from the SPEC, never from the proof.
    expect(screen.getByText(/of 3 claims/)).toBeTruthy();
    expect(screen.getByText("2 marked, unproved")).toBeTruthy();

  });

  it("nothing owed draws no owed tag at all — a zero is not news", () => {
    render(
      <MarkdownMembersProvider value={{ source: MIXED.replace('::claim[marked, nothing behind it]{id=c2 state=met by=you at=1}\n', "") }}>
        <Claims />
      </MarkdownMembersProvider>,
    );
    expect(screen.queryByText(/owed/)).toBeNull();
  });
});

// c19's untested half — `by eye` rides the KIND ALONE. Every other case here marks the claim
// first, so "marked or not" was half-covered: an unmarked experiential claim is still his eye's to
// conclude, and the row must say so before anybody has concluded anything.
describe("by eye on an experiential claim that nobody has marked yet", () => {
  const DOC = [
    "# RFC-9",
    ":::claim[his eye decides, unmarked]{id=c1 kind=experiential}",
    "::file[RFCs/proofs/badge.png]",
    ":::",
  ].join("\n");

  it("says `by eye` with no mark anywhere, and still asks for no spec", () => {
    render(
      <MarkdownMembersProvider value={{ source: DOC }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
          <Claim attrs={{ id: "c1", kind: "experiential" }} kind="container" label="his eye decides, unmarked" line={2} />
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>,
    );
    expect(screen.getByText("by eye")).toBeTruthy();
    expect(screen.queryByText("no spec")).toBeNull();
  });
});
