import { LEAF_KINDS, leafLineNo, idFromKey, addLeafPlan, registrationOf, kindBadge } from "./registrationLeaf";

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

// READING THE LEAF, not writing one. The code pane's header badge said `code` over an RFC — true
// about where the file sits, useless about what it is, and directly under a legend that had just
// taught the reader what an RFC badge looks like. These pin the answer being right for the right
// reason: a real leaf on its own line, never prose that mentions one.
describe("registrationOf — what a document says it is", () => {
  it("reads the kind and the id", () => {
    expect(registrationOf("# Title\n\n::rfc{id=RFC-064}\n\nbody")).toEqual({ kind: "rfc", id: "RFC-064" });
    expect(registrationOf("::gap{id=G-12}")).toEqual({ kind: "gap", id: "G-12" });
    expect(registrationOf("::arc{id=ARC-001}")).toEqual({ kind: "arc", id: "ARC-001" });
  });

  // A report's id is a sentence, so the quoted form is the common one rather than an edge case.
  it("reads a quoted id, with other attributes after it", () => {
    expect(registrationOf('::report{id="What a good test is" as=planning retain=48h}')).toEqual({
      kind: "report",
      id: "What a good test is",
    });
  });

  // THE CLAIM THAT STOPS A DOCUMENT *ABOUT* RFCS CLAIMING TO BE ONE.
  it("prose that mentions a leaf is prose", () => {
    expect(registrationOf("Write the leaf as ::rfc{id=RFC-NNN} under the title.")).toBeNull();
    expect(registrationOf("a `::report` block carries a clock")).toBeNull();
  });

  it("a file that declares nothing says so, rather than guessing", () => {
    expect(registrationOf("# Just markdown\n\nnothing here.")).toBeNull();
    expect(registrationOf("")).toBeNull();
    expect(registrationOf(null)).toBeNull();
  });

  it("the FIRST leaf wins — a document is one kind, same rule leafLineNo follows", () => {
    expect(registrationOf("::rfc{id=RFC-1}\n::gap{id=G-1}").kind).toBe("rfc");
  });

  // A leaf mid-authoring has `id=` empty; the badge can still say RFC, and returning null would
  // badge it as plain code while the caret is still in the attribute.
  it("an empty id still names the kind", () => {
    expect(registrationOf("::rfc{id=}")).toEqual({ kind: "rfc", id: "" });
  });

  // AGAINST A REAL DOCUMENT, because a helper that only satisfies its own fixtures proves nothing
  // about the files it will meet.
  it("answers for a real registered document in this repo", () => {
    const fs = require("fs");
    const path = require("path");
    const rfc = fs.readFileSync(
      path.join(__dirname, "..", "..", "..", "RFCs", "RFC-064-one-portable-folder.md"),
      "utf8"
    );
    expect(registrationOf(rfc)).toEqual({ kind: "rfc", id: "RFC-064" });
  });
});

// THE BADGE DECISION. Order is the argument: what a document DECLARES outranks where its file sits.
describe("kindBadge — what the pane header says", () => {
  it("a registered document wears its kind, not its location", () => {
    expect(kindBadge({ path: "RFCs/RFC-064-x.md", text: "::rfc{id=RFC-064}" })).toEqual({
      label: "rfc", kind: "rfc", id: "RFC-064",
    });
  });
  it("plain markdown is still code — a leaf is a declaration, not an assumption about .md", () => {
    expect(kindBadge({ path: "README.md", text: "# hello" })).toEqual({ label: "code", kind: null, id: "" });
  });
  it("a source file is never read for a leaf, whatever its comments say", () => {
    expect(kindBadge({ path: "src/x.js", text: "// ::rfc{id=RFC-1}" })).toEqual({
      label: "code", kind: null, id: "",
    });
  });
  it("outside every project it still says machine", () => {
    expect(kindBadge({ path: "/tmp/notes.txt", machine: true }).label).toBe("machine");
  });
  // A registered document outside every project is still that document — the declaration wins.
  it("a declaration outranks machine too", () => {
    expect(kindBadge({ path: "/tmp/g.md", text: "::gap{id=G-9}", machine: true }).label).toBe("gap");
  });
  it("no arguments at all does not throw", () => {
    expect(kindBadge().label).toBe("code");
  });
});
