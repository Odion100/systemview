import { rfcRows, stateOf, rfcIdFromPath, titleOf, rfcLine } from "./rfcRows";

// THE FAILURE THIS REPLACES. The strip said "2 approvals waiting" while scanning reports only, so
// an approval sitting in an RFC was invisible — RFC-050 and RFC-072 both held one and nothing in
// the window said so. Every claim here is about a decision being FINDABLE.

const doc = (id, body) => ({ path: `RFCs/${id}-a-thing.md`, text: body });
const APPROVAL = (attrs = "") => `:::approval{ask="Approve it?"${attrs}}\nwhat it commits to\n:::`;

describe("what state an RFC is in, read from its approval blocks", () => {
  it("is WAITING when a block carries no verdict — the whole point of the tab", () => {
    expect(stateOf(APPROVAL())).toMatchObject({ state: "waiting", waiting: 1, approvals: 1 });
  });

  it("is approved once the verdict is written in", () => {
    expect(stateOf(APPROVAL(" verdict=approved"))).toMatchObject({ state: "approved", waiting: 0 });
  });

  // A DOCUMENT WITH NO APPROVAL IS A DRAFT, NOT A DECISION PENDING. Counting it as waiting would
  // make the bubble say every unfinished thought needs him.
  it("is a draft when there is no approval block at all, and counts nothing as waiting", () => {
    expect(stateOf("# RFC-001 — a thought\n\nsome prose")).toMatchObject({ state: "draft", waiting: 0 });
  });

  // A REJECTION CLOSES THE DOCUMENT. Reading "approved" over a rejected one is the dangerous
  // direction to be wrong in, so rejected wins when both appear.
  it("reads rejected over approved when a document carries both", () => {
    expect(stateOf(`${APPROVAL(" verdict=approved")}\n\n${APPROVAL(" verdict=rejected")}`).state).toBe("rejected");
  });

  // RFC-072's real shape tonight: one decided, one still open underneath it.
  it("still says waiting when one block is decided and another is not", () => {
    expect(stateOf(`${APPROVAL(" verdict=approved")}\n\n${APPROVAL()}`)).toMatchObject({
      state: "waiting",
      waiting: 1,
      approvals: 2,
    });
  });
});

describe("the row, and the order he reads it in", () => {
  it("takes the number from the path and the title from the document, minus its own number", () => {
    expect(rfcIdFromPath("RFCs/RFC-072-arc-planning-and-execution.md")).toBe("RFC-072");
    expect(titleOf("# RFC-072 — Arc planning and execution\n", "RFCs/RFC-072-x.md")).toBe(
      "Arc planning and execution",
    );
  });

  it("falls back to the filename when the document has no heading", () => {
    expect(titleOf("", "RFCs/RFC-050-interactive-blocks-in-the-chat.md")).toBe("interactive blocks in the chat");
  });

  it("puts what is waiting on him first, then drafts, then everything decided", () => {
    const rows = rfcRows([
      doc("RFC-010", APPROVAL(" verdict=approved")),
      doc("RFC-020", "no approval here"),
      doc("RFC-030", APPROVAL()),
      doc("RFC-040", APPROVAL(" verdict=rejected")),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["RFC-030", "RFC-020", "RFC-010", "RFC-040"]);
  });

  it("leads with the highest number inside a group, because the recent one is the one in play", () => {
    const rows = rfcRows([doc("RFC-005", APPROVAL()), doc("RFC-072", APPROVAL())]);
    expect(rows.map((r) => r.id)).toEqual(["RFC-072", "RFC-005"]);
  });

  // A rejected RFC is CLOSED, not deleted — and it is the one somebody is most likely to reopen by
  // accident, so it stays visible saying what it is.
  it("keeps a rejected RFC in the list and says it is closed", () => {
    expect(rfcLine(rfcRows([doc("RFC-040", APPROVAL(" verdict=rejected"))])[0])).toBe("rejected — closed");
    expect(rfcLine({ state: "waiting", waiting: 2 })).toBe("2 to approve");
  });

  it("ignores a file that is not an RFC at all", () => {
    expect(rfcRows([{ path: "RFCs/notes.md", text: APPROVAL() }])).toEqual([]);
  });
});
