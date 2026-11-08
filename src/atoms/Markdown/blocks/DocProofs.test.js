import React from "react";
import { render } from "@testing-library/react";
import DocProofs from "./DocProofs";
import { InEmbedProvider } from "../context";

// WHICH LEAF OWNS THE PROOFS PANEL — and the answer is not "whichever mounted last".
//
// MEASURED 2026-11-07 on his live window. One document open, and the proofs panel kept losing its
// listing a beat after it arrived: *"the test show up for a second and then go away."* The document
// carried `::file[<another report>#L1-5]`, and line 1 of that file is its own `::report` leaf — so
// the embed rendered a SECOND leaf inside the first document, which claimed the panel for an id
// nobody had open. The panel then truthfully reported "Nothing to run in this document" over a
// document holding three specs.
//
// The embed is right to RENDER the leaf; a reader asked to see those lines. What it may not do is
// ACT with it, which is the same rule the embed already keeps for edits — nothing in a quotation
// writes to the thing quoting it.
jest.mock("../../../utils/proofsBus", () => ({ list: jest.fn() }));
jest.mock("../../../utils/effectiveProject", () => (given) => given || "");

const { list } = require("../../../utils/proofsBus");

describe("only the document's OWN leaf loads its specs into the panel", () => {
  beforeEach(() => list.mockClear());

  it("a leaf in the document claims the panel, with its id and project", () => {
    render(<DocProofs id="The board answers the question it was asked" projectCode="systemview-test" />);
    expect(list).toHaveBeenCalledWith("systemview-test", { document: "The board answers the question it was asked" });
  });

  it("a leaf QUOTED inside an embed claims nothing — it is another document's identity", () => {
    render(
      <InEmbedProvider>
        <DocProofs id="Runs belong to the agent" projectCode="systemview-test" />
      </InEmbedProvider>,
    );
    expect(list).not.toHaveBeenCalled();
  });

  // THE EXACT SHAPE OF HIS FLICKER: both leaves mount in one pass, the host's first. Before the
  // fix the second call replaced the first, which is the whole of the symptom.
  it("the host's listing survives an embedded leaf mounting after it", () => {
    render(
      <>
        <DocProofs id="The board answers the question it was asked" projectCode="systemview-test" />
        <InEmbedProvider>
          <DocProofs id="Runs belong to the agent" projectCode="systemview-test" />
        </InEmbedProvider>
      </>,
    );
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith("systemview-test", { document: "The board answers the question it was asked" });
  });

  it("asks for nothing when it has no id or no project — there is no listing to make", () => {
    render(<DocProofs id="" projectCode="systemview-test" />);
    render(<DocProofs id="Something" projectCode="" />);
    expect(list).not.toHaveBeenCalled();
  });
});
