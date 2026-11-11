import React from "react";
import { render } from "@testing-library/react";
import DocProofs from "./DocProofs";
import { InEmbedProvider, ShownProvider } from "../context";

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

// ─── AND WHICH OF THE OPEN DOCUMENTS IS THE ONE HE PICKED ───────────────────────────────────────
//
// His report, 2026-11-11: *"the test on the side… it should be whatever document you're selected,
// because you could select the tabs even though you have multiple different panes open."*
//
// Mount used to be the signal, on the stated grounds that only the active document is ever in the
// DOM. The split ended that twice over — a hidden tab keeps its pane mounted so its scroll survives,
// and two panes hold two documents at once — so the panel went to whichever leaf rendered last and
// clicking a tab, which unmounts nothing, changed nothing.
describe("the panel belongs to the SELECTED document, not to whatever is mounted", () => {
  beforeEach(() => list.mockClear());

  it("a document that is mounted but NOT selected claims nothing", () => {
    render(
      <ShownProvider value={false}>
        <DocProofs id="The other pane's document" projectCode="systemview-test" />
      </ShownProvider>,
    );
    expect(list).not.toHaveBeenCalled();
  });

  it("with two documents on screen, only the selected one loads its specs", () => {
    render(
      <>
        <ShownProvider value={false}>
          <DocProofs id="Left pane" projectCode="systemview-test" />
        </ShownProvider>
        <ShownProvider value={true}>
          <DocProofs id="Right pane — the one he clicked" projectCode="systemview-test" />
        </ShownProvider>
      </>,
    );
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith("systemview-test", { document: "Right pane — the one he clicked" });
  });

  it("SELECTING a document that was already mounted loads it — the click is what fires it", () => {
    // The case mount could never answer: nothing unmounts, so only a change of selection is left.
    const { rerender } = render(
      <ShownProvider value={false}>
        <DocProofs id="RFC-076" projectCode="systemview-test" />
      </ShownProvider>,
    );
    expect(list).not.toHaveBeenCalled();
    rerender(
      <ShownProvider value={true}>
        <DocProofs id="RFC-076" projectCode="systemview-test" />
      </ShownProvider>,
    );
    expect(list).toHaveBeenCalledWith("systemview-test", { document: "RFC-076" });
  });

  it("a host that never mentions selection behaves exactly as before — the default is shown", () => {
    // The Agents page, a report embed, a fixture: one document at a time, nothing to disambiguate.
    render(<DocProofs id="Only document here" projectCode="systemview-test" />);
    expect(list).toHaveBeenCalledWith("systemview-test", { document: "Only document here" });
  });
});
