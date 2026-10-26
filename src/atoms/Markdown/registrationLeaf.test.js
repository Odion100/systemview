import { LEAF_KINDS, leafLineNo, idFromKey, addLeafPlan } from "./registrationLeaf";

// RFC-073 c10 — registering a document is a PICK. These guard the plan: the leaf lands at the TOP
// (where ::members lands), it is filled from where the document lives, and a document that already
// says what it is takes no second identity.

const BARE = ["# RFC-073 — a title", "", "The lead paragraph.", "", "## The problem", "", "body"].join("\n");
const REGISTERED = ["# A doc", "", "::rfc{id=RFC-073}", "", "## Design"].join("\n");

describe("leafLineNo — one identity per document", () => {
  it("finds an existing leaf, whatever kind it is", () => {
    expect(leafLineNo(REGISTERED)).toBe(3);
    expect(leafLineNo("::gap{id=G-12}\n\nbody")).toBe(1);
  });
  it("0 when the document says nothing — the register door is open", () => {
    expect(leafLineNo(BARE)).toBe(0);
  });
});

describe("idFromKey — filled from where the document lives", () => {
  it("a numbered identity is taken whole off the filename", () => {
    expect(idFromKey("file-RFCs/RFC-073-a-document-state.md", "rfc")).toBe("RFC-073");
    expect(idFromKey("file-RFCs/arcs/ARC-004-arcs-become-trackable.md", "arc")).toBe("ARC-004");
    expect(idFromKey("file-GAPS/G-12-karaoke-fences.md", "gap")).toBe("G-12");
  });
  it("a report keeps the filename's stem as its id — an id a human chose once", () => {
    expect(idFromKey("file-.systemview/report.subscribe-and-registration.md", "report")).toBe(
      "report.subscribe-and-registration",
    );
  });
  it("an rfc or arc with no number stays empty rather than guessing one", () => {
    expect(idFromKey("file-docs/designs/some-design.md", "rfc")).toBe("");
  });
  it("a surface with no file behind it fills nothing", () => {
    expect(idFromKey("tv-systemview-test", "rfc")).toBe("");
    expect(idFromKey(null, "report")).toBe("");
  });
});

describe("addLeafPlan — where and what", () => {
  it("lands at the top — after the title and lead, before the first heading — filled", () => {
    const plan = addLeafPlan(BARE, "rfc", "file-RFCs/RFC-073-a-document-state.md");
    expect(plan).toEqual({ insertAfter: 4, text: "::rfc{id=RFC-073}" });
  });
  it("a document that already carries a leaf takes no second identity", () => {
    const plan = addLeafPlan(REGISTERED, "report", "file-x.md");
    expect(plan.already).toEqual({ line: 3, name: "rfc" });
  });
  it("the menu offers exactly the four kinds, each naming its fields", () => {
    expect(LEAF_KINDS.map((k) => k.kind)).toEqual(["rfc", "arc", "report", "gap"]);
    expect(LEAF_KINDS.every((k) => k.fields.includes("id"))).toBe(true);
  });
});
