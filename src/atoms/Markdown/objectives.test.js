import {
  STATES, normalizeState, nextState, addressOf, parseAddress,
  parseObjectives, parseArc, resolveNeed, resolveNeeds, isBlockedByNeeds, arcProgress,
} from "./objectives";

// RFC-072's own example, verbatim from the document — if the shape the RFC shows does not parse,
// nothing built on it is worth anything.
const RFC_EXAMPLE = [
  "::::objective{id=O2 owner=autobot state=open needs=ARC-004-O1}",
  "Teach the harness to deliver a document update without a hook being armed.",
  "",
  "**why** — membership must not depend on somebody remembering to arm something.",
  "**test** — a member's session receives the update with no hook carried by anyone.",
  "::::",
  "",
].join("\n");

describe("states", () => {
  it("is four and no more — blocked is written, never derived", () => {
    expect(STATES).toEqual(["open", "doing", "done", "blocked"]);
  });

  it("treats anything it does not know as open rather than inventing a state", () => {
    expect(normalizeState("in-progress")).toBe("open");
    expect(normalizeState("")).toBe("open");
    expect(normalizeState(undefined)).toBe("open");
  });

  it("is case and space tolerant, because a human types the attribute", () => {
    expect(normalizeState("  DONE ")).toBe("done");
  });

  it("walks open → doing → done → open when pressed", () => {
    expect(nextState("open")).toBe("doing");
    expect(nextState("doing")).toBe("done");
    expect(nextState("done")).toBe("open");
  });

  // blocked is a statement about the world, not a step in a cycle.
  it("unsticks from blocked rather than cycling through it", () => {
    expect(nextState("blocked")).toBe("open");
    expect(RING_FREE()).toBe(true);
  });
  const RING_FREE = () => !["open", "doing", "done"].some((s) => nextState(s) === "blocked");
});

describe("an address is the one part of this that is still a format", () => {
  it("reads an arc-local address", () => {
    expect(parseAddress("ARC-004-O2")).toMatchObject({ project: "", arc: "ARC-004", objective: "O2" });
  });

  it("reads a cross-repo address", () => {
    expect(parseAddress("autobot/ARC-002-O1")).toMatchObject({ project: "autobot", arc: "ARC-002", objective: "O1" });
  });

  it("refuses something that merely looks like one", () => {
    expect(parseAddress("ARC-004")).toBe(null);
    expect(parseAddress("O2")).toBe(null);
    expect(parseAddress("arc-4-o2")).toBe(null);
    expect(parseAddress("")).toBe(null);
  });

  it("writes the address the skill will assign", () => {
    expect(addressOf("ARC-004", "O2")).toBe("ARC-004-O2");
    expect(addressOf("ARC-004", "2")).toBe("ARC-004-O2");
    expect(addressOf("ARC-002", "O1", "autobot")).toBe("autobot/ARC-002-O1");
  });
});

describe("reading objectives out of a document", () => {
  it("parses the exact block the RFC specifies", () => {
    const [o] = parseObjectives(RFC_EXAMPLE);
    expect(o).toMatchObject({ id: "O2", owner: "autobot", state: "open", needs: ["ARC-004-O1"], line: 1 });
  });

  it("carries the line it opens on, because a press writes back there", () => {
    const src = ["# arc", "", ":::objective{id=O1}", "do it", ":::", ""].join("\n");
    expect(parseObjectives(src)[0].line).toBe(3);
  });

  // A block nests by GAINING colons — an objective inside a thread opens deeper than the thread.
  it("finds an objective wrapped in a thread", () => {
    const src = ["::::thread{id=t1}", ":::objective{id=O1}", "x", ":::", "::::", ""].join("\n");
    expect(parseObjectives(src).map((o) => o.id)).toEqual(["O1"]);
  });

  it("ignores a block with no id — an objective nobody can address is not one", () => {
    expect(parseObjectives(":::objective{owner=me}\nx\n:::\n")).toEqual([]);
  });

  it("reads several needs however they are separated", () => {
    const src = ':::objective{id=O3 needs="ARC-004-O1|ARC-004-O2"}\nx\n:::\n';
    expect(parseObjectives(src)[0].needs).toEqual(["ARC-004-O1", "ARC-004-O2"]);
  });

  it("answers an empty document with an empty list, not a throw", () => {
    expect(parseObjectives("")).toEqual([]);
    expect(parseObjectives(undefined)).toEqual([]);
  });
});

describe("the arc block makes the document self-describing", () => {
  it("reads the arc off the top of the file", () => {
    const src = ["::arc{id=ARC-004 owner=systemview-test}", "", "prose"].join("\n");
    expect(parseArc(src)).toMatchObject({ id: "ARC-004", owner: "systemview-test", line: 1 });
  });

  it("is null when the document is not an arc — no filename convention, no index", () => {
    expect(parseArc("# just a plan\n")).toBe(null);
  });
});

describe("needs — an address that does not resolve must SAY so", () => {
  const doc = [
    "::arc{id=ARC-004}",
    ":::objective{id=O1 state=done}",
    "first",
    ":::",
    ":::objective{id=O2 state=open needs=ARC-004-O1}",
    "second",
    ":::",
    ":::objective{id=O3 state=open needs=ARC-004-O9}",
    "third",
    ":::",
    "",
  ].join("\n");
  const ctx = () => ({ objectives: parseObjectives(doc), arc: parseArc(doc) });

  it("says met when the objective it names is done", () => {
    expect(resolveNeed("ARC-004-O1", ctx()).status).toBe("met");
  });

  it("says waiting when it exists and is not done", () => {
    const c = ctx();
    expect(resolveNeed("ARC-004-O2", c).status).toBe("waiting");
  });

  // THE RULE. Silence here lets work start in the wrong order, and wrong order reads as BROKEN.
  it("says unresolved — never nothing — when no objective answers to it", () => {
    const r = resolveNeed("ARC-004-O9", ctx());
    expect(r.status).toBe("unresolved");
    expect(r.why).toMatch(/no objective here/);
  });

  it("says unresolved for a string that is not an address at all", () => {
    expect(resolveNeed("the other one", ctx())).toMatchObject({ status: "unresolved", why: "not an address" });
  });

  it("says elsewhere for another repo rather than guessing either way", () => {
    expect(resolveNeed("autobot/ARC-002-O1", ctx()).status).toBe("elsewhere");
  });

  it("says elsewhere for a different arc — this document cannot see it", () => {
    expect(resolveNeed("ARC-009-O1", ctx()).status).toBe("elsewhere");
  });

  it("resolves every need of one objective", () => {
    const c = ctx();
    const o3 = c.objectives.find((o) => o.id === "O3");
    expect(resolveNeeds(o3, c).map((r) => r.status)).toEqual(["unresolved"]);
  });

  // Guessing permissively is exactly how a cross-repo pair gets pressed in the wrong order.
  it("treats what it cannot see as blocking, never as met", () => {
    const c = ctx();
    expect(isBlockedByNeeds(c.objectives.find((o) => o.id === "O2"), c)).toBe(false);
    expect(isBlockedByNeeds(c.objectives.find((o) => o.id === "O3"), c)).toBe(true);
    expect(isBlockedByNeeds({ needs: ["autobot/ARC-002-O1"] }, c)).toBe(true);
  });

  it("an objective with no needs is never blocked by them", () => {
    expect(isBlockedByNeeds({ needs: [] }, ctx())).toBe(false);
    expect(isBlockedByNeeds({}, ctx())).toBe(false);
  });
});

describe("progress is objectives complete — there are no milestones", () => {
  it("counts the document it is given", () => {
    const src = [
      ":::objective{id=O1 state=done}", "a", ":::",
      ":::objective{id=O2 state=doing}", "b", ":::",
      ":::objective{id=O3}", "c", ":::", "",
    ].join("\n");
    expect(arcProgress(src)).toMatchObject({ total: 3, done: 1 });
  });

  it("is zero of zero on a document with none, rather than a divide by nothing", () => {
    expect(arcProgress("# nothing here\n")).toMatchObject({ total: 0, done: 0, arc: null });
  });
});

describe("attribute values follow the directive syntax, and the sharp edge is recorded", () => {
  // FOUND BY USE, not by reading: walking a realistic arc through the parser produced
  // title: "Arc" from `title=Arc planning and execution`. That is not a defect here — an
  // unquoted value ends at the first space in directive syntax, and the renderer does exactly the
  // same thing. Diverging would give the document two parsers that disagree, which is the failure
  // this vocabulary was bitten by three times in one day. So it is pinned instead: the behaviour
  // is correct, and anything WRITING these blocks must quote a multi-word value.
  it("truncates an unquoted multi-word value at the first space, as the renderer does", () => {
    expect(parseArc("::arc{id=ARC-004 title=Arc planning and execution}\n").title).toBe("Arc");
  });

  it("keeps the whole value when it is quoted, which is how one should be written", () => {
    expect(parseArc('::arc{id=ARC-004 title="Arc planning and execution"}\n').title).toBe(
      "Arc planning and execution"
    );
  });

  it("the same rule holds for an objective's owner", () => {
    expect(parseObjectives(':::objective{id=O1 owner="the window team"}\nx\n:::\n')[0].owner).toBe(
      "the window team"
    );
  });
});

// ── RFC-072 §5 — the derivation, which is the half that can be wrong ────────────────────────────
import { progressOf, timelineOf } from "./objectives";

const obj = (id, { state = "open", owner = "", needs = "" } = {}) =>
  [`:::objective{id=${id}${owner ? ` owner=${owner}` : ""} state=${state}${needs ? ` needs=${needs}` : ""}}`, id, ":::"].join("\n");

describe("progress — objectives complete, and nothing else", () => {
  const src = [
    "::arc{id=ARC-004}",
    obj("O1", { state: "done", owner: "systemview-test" }),
    obj("O2", { state: "doing", owner: "autobot" }),
    obj("O3", { state: "open", owner: "autobot" }),
    obj("O4", { state: "blocked" }),
    "",
  ].join("\n");

  it("counts every state separately rather than collapsing them", () => {
    expect(progressOf(src)).toMatchObject({ total: 4, done: 1, doing: 1, open: 1, blocked: 1 });
  });

  it("groups by owner, most work first", () => {
    expect(progressOf(src).byOwner.map((r) => [r.owner, r.total, r.done])).toEqual([
      ["autobot", 2, 0],
      ["systemview-test", 1, 1],
      ["unowned", 1, 0],
    ]);
  });

  // An objective with no owner must still be a row — work no listing shows is work nobody does.
  it("gives an unowned objective a name rather than dropping it", () => {
    expect(progressOf(obj("O1")).byOwner).toEqual([{ owner: "unowned", total: 1, done: 0 }]);
  });

  it("answers an empty document with zeroes, not a divide by nothing", () => {
    expect(progressOf("")).toMatchObject({ total: 0, done: 0, byOwner: [] });
  });
});

describe("timeline — dependency order, and the three things it has to survive", () => {
  it("puts a dependency before the objective that needs it", () => {
    const src = ["::arc{id=ARC-004}", obj("O2", { needs: "ARC-004-O1" }), obj("O1"), ""].join("\n");
    expect(timelineOf(src).map((o) => o.id)).toEqual(["O1", "O2"]);
  });

  it("orders a chain the whole way down", () => {
    const src = [
      "::arc{id=ARC-004}",
      obj("O3", { needs: "ARC-004-O2" }),
      obj("O2", { needs: "ARC-004-O1" }),
      obj("O1"),
      "",
    ].join("\n");
    expect(timelineOf(src).map((o) => o.id)).toEqual(["O1", "O2", "O3"]);
  });

  // A CYCLE IS SOMETHING A PERSON WILL WRITE. Dropping both would read as "no such work".
  it("emits a cycle instead of dropping it or looping forever", () => {
    const src = [
      "::arc{id=ARC-004}",
      obj("O1", { needs: "ARC-004-O2" }),
      obj("O2", { needs: "ARC-004-O1" }),
      "",
    ].join("\n");
    const t = timelineOf(src);
    expect(t.map((o) => o.id).sort()).toEqual(["O1", "O2"]);
    expect(t.every((o) => o.cycle)).toBe(true);
  });

  it("keeps the objectives outside a cycle correctly ordered around it", () => {
    const src = [
      "::arc{id=ARC-004}",
      obj("O1"),
      obj("O2", { needs: "ARC-004-O3" }),
      obj("O3", { needs: "ARC-004-O2" }),
      "",
    ].join("\n");
    const t = timelineOf(src);
    expect(t[0].id).toBe("O1");
    expect(t.filter((o) => o.cycle).map((o) => o.id).sort()).toEqual(["O2", "O3"]);
  });

  // A need we cannot see can never become met, so waiting on it would park the objective forever.
  it("does not let an unseeable need hold up the order", () => {
    const src = ["::arc{id=ARC-004}", obj("O1", { needs: "autobot/ARC-002-O1" }), ""].join("\n");
    const [o] = timelineOf(src);
    expect(o.cycle).toBe(false);
    expect(o.blockedBy.map((b) => b.status)).toEqual(["elsewhere"]);
  });

  it("carries an unresolved need onto the objective rather than silently ordering around it", () => {
    const src = ["::arc{id=ARC-004}", obj("O1", { needs: "ARC-004-O9" }), ""].join("\n");
    expect(timelineOf(src)[0].blockedBy.map((b) => b.status)).toEqual(["unresolved"]);
  });

  it("is empty for a document with no objectives, not a throw", () => {
    expect(timelineOf("# nothing\n")).toEqual([]);
    expect(timelineOf("")).toEqual([]);
  });
});

// THE NAME YOU CAN SCAN. His correction, looking at the first real arc: *"I don't think you really
// titled these things so I can see what is what."* An objective's id addresses it and its prose
// explains it; neither is a name you can read down a list of seven. `::arc` already carried a
// title, so this is the same vocabulary one level in — and optional, because an objective with no
// title must still parse and still address.
describe("an objective carries a title it can be scanned by", () => {
  it("reads the title off the attributes", () => {
    const [o] = parseObjectives(':::objective{id=O1 owner=me state=doing title="The method has a home"}\n:::');
    expect(o.title).toBe("The method has a home");
    expect(o.id).toBe("O1");
  });

  it("leaves it empty rather than absent when nobody wrote one", () => {
    const [o] = parseObjectives(":::objective{id=O2}\n:::");
    expect(o.title).toBe("");
    expect(o.id).toBe("O2");
  });

  // The timeline is the list that actually gets read down, so the title has to survive the
  // ordering — an ordered list of ids is the thing this fixes.
  it("carries the title through the timeline so the order is readable", () => {
    const doc = [
      ':::objective{id=O1 title="First thing" state=done}',
      ":::",
      ':::objective{id=O2 title="Second thing" needs=O1}',
      ":::",
    ].join("\n");
    expect(timelineOf(doc).map((o) => o.title)).toEqual(["First thing", "Second thing"]);
  });
});

// FOUND BY USING IT, which is the only way this one ever surfaces. The first real arc document also
// EXPLAINED the vocabulary, so it carried a fenced ```markdown example of an `::objective` — and
// the line scan counted the example. `::progress` read 8 objectives where `::timeline` read 7,
// because the example reused a real id and only one of the two readers deduped. A document that
// documents the blocks it uses is the normal case here, not an exotic one.
describe("a fenced example is a quotation, not a declaration", () => {
  const DOC = [
    "::arc{id=ARC-001 title=\"Real\"}",
    "",
    ":::objective{id=O1 state=done title=\"Real one\"}",
    "body",
    ":::",
    "",
    "Here is how you write one:",
    "",
    "```markdown",
    "::arc{id=ARC-999 title=\"Not a real arc\"}",
    ":::objective{id=O1 state=open title=\"Not a real objective\"}",
    "body",
    ":::",
    "```",
  ].join("\n");

  it("does not count an objective written inside a code fence", () => {
    expect(parseObjectives(DOC).map((o) => o.title)).toEqual(["Real one"]);
    expect(arcProgress(DOC)).toMatchObject({ total: 1, done: 1 });
  });

  it("does not take its arc identity from a fenced example", () => {
    expect(parseArc(DOC).id).toBe("ARC-001");
  });

  // The press writes back by LINE NUMBER, so stripping fenced lines must not shift the lines that
  // remain — a fenced block earlier in the file would otherwise make every press land one row off.
  it("keeps real line numbers when a fence sits above an objective", () => {
    const doc = ["```md", "::arc{id=ARC-9}", "```", "", ':::objective{id=O1}', ":::"].join("\n");
    expect(parseObjectives(doc)[0].line).toBe(5);
  });

  it("lets a ``` example sit inside a ~~~ fence without ending it early", () => {
    const doc = [
      ':::objective{id=O1 title="Real"}',
      ":::",
      "~~~markdown",
      "```",
      ':::objective{id=O2 title="Quoted"}',
      ":::",
      "```",
      "~~~",
    ].join("\n");
    expect(parseObjectives(doc).map((o) => o.title)).toEqual(["Real"]);
  });
});

// A BLOCKED OBJECTIVE HAS TO SAY WHAT IS HOLDING IT. `blocked` is the one state that is written
// rather than derived, on the grounds that it is a statement about the world — and a statement with
// no content is not one. The first real arc had an objective reading `blocked` with nothing
// anywhere saying why, and the only honest answer to "why is this blocked" was "nobody recorded it".
describe("a blocked objective carries its reason", () => {
  it("reads the reason off the block", () => {
    const [o] = parseObjectives(':::objective{id=O5 state=blocked blocked="the board has no door"}\n:::');
    expect(o.state).toBe("blocked");
    expect(o.because).toBe("the board has no door");
  });

  // Empty rather than absent, so a surface can tell "nobody wrote one" from "there isn't one" and
  // say so, instead of rendering a state nobody can act on as though it were finished.
  it("leaves it empty when nobody wrote one, rather than inventing a reason", () => {
    expect(parseObjectives(":::objective{id=O6 state=blocked}\n:::")[0].because).toBe("");
  });

  // The reason is not a dependency. `needs` is machinery the document resolves; this is prose about
  // the world, and collapsing them would make an unresolvable address look like an explanation.
  it("is separate from needs, which the document resolves on its own", () => {
    const [o] = parseObjectives(':::objective{id=O7 state=blocked needs=ARC-001-O1 blocked="waiting on a press"}\n:::');
    expect(o.needs).toEqual(["ARC-001-O1"]);
    expect(o.because).toBe("waiting on a press");
  });
});
