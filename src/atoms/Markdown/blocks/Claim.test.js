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
    expect(screen.getByText("you")).toBeTruthy();
    expect(screen.getByText("went 4 to 3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
});

describe("the press — his press is the evidence; the note is optional", () => {
  it("pressing ✓ writes state, by=you and at at once, with no note demanded", () => {
    const { setAttr } = mount();
    fireEvent.click(screen.getByTitle("Met — writes into the document"));
    expect(setAttr).toHaveBeenCalledTimes(1);
    const [line, pairs] = setAttr.mock.calls[0];
    expect(line).toBe(2);
    expect(pairs).toMatchObject({ state: "met", by: "you", note: null });
    expect(typeof pairs.at).toBe("number");
    expect(screen.getByText("met")).toBeTruthy();
    expect(screen.getByText("+ what you saw")).toBeTruthy();
  });

  it("a note can be added after the mark, and lands as its own write", () => {
    const { setAttr } = mount();
    fireEvent.click(screen.getByTitle("Met — writes into the document"));
    fireEvent.click(screen.getByText("+ what you saw"));
    fireEvent.change(screen.getByPlaceholderText("what you did, and what you saw (optional)"), { target: { value: "ran it; saw the row" } });
    fireEvent.keyDown(screen.getByPlaceholderText("what you did, and what you saw (optional)"), { key: "Enter" });
    expect(setAttr).toHaveBeenCalledTimes(2);
    expect(setAttr.mock.calls[1]).toEqual([2, { note: "ran it; saw the row" }]);
    expect(screen.getByText("ran it; saw the row")).toBeTruthy();
  });

  it("not met writes unmet and offers 'what happens instead'", () => {
    const { setAttr } = mount();
    fireEvent.click(screen.getByTitle("Not met — writes into the document"));
    expect(setAttr.mock.calls[0][1]).toMatchObject({ state: "unmet", by: "you" });
    expect(screen.getByText("+ what happens instead")).toBeTruthy();
  });

  it("pressing the mark you already gave withdraws it — every attribute removed", () => {
    const { setAttr } = mount({ attrs: { id: "c2", state: "met", by: "you", at: "1", note: "x" }, line: 3 });
    fireEvent.click(screen.getByTitle("Click again to withdraw"));
    expect(setAttr).toHaveBeenCalledWith(3, { state: null, by: null, at: null, note: null });
    expect(screen.getByText("unchecked")).toBeTruthy();
  });

  it("read-only surfaces cannot mark, and say so", () => {
    const { setAttr } = mount({ editable: false });
    const btns = screen.getAllByTitle("Read-only here — this surface has nothing to save to");
    expect(btns).toHaveLength(2);
    expect(btns.every((b) => b.disabled)).toBe(true);
    fireEvent.click(btns[0]);
    expect(setAttr).not.toHaveBeenCalled();
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
