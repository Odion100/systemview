import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Claim from "./Claim";
import Claims from "./Claims";
import { MarkdownWriteProvider, MarkdownMembersProvider } from "../context";

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

describe("::claim — the statement, numbered by its place", () => {
  it("shows the statement, its number from the document, and reads unchecked until marked", () => {
    mount();
    expect(screen.getByText("Open the list → rows show when parsed")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("unchecked")).toBeTruthy();
  });

  it("a marked claim shows who, and the statement the mark carries", () => {
    mount({ attrs: { id: "c2", state: "met", by: "you", at: "1792956000000", note: "went 4 to 3" }, label: "Approve it → the count drops", line: 3 });
    expect(screen.getByText("met")).toBeTruthy();
    expect(screen.getByText(/✓ you/)).toBeTruthy();
    expect(screen.getByText("went 4 to 3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
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
  const ALL_MET = [
    "::claims",
    '::claim[a]{id=c1 state=met by=you at=1}',
    '::claim[b]{id=c2 state=met by=sv at=1 note="n"}',
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
    expect(screen.getByText("1/2 reviewed")).toBeTruthy();
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
    expect(screen.getByText("1/2 met")).toBeTruthy();
    expect(screen.getByText("1 unchecked")).toBeTruthy();
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
