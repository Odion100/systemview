import fs from "fs";
import path from "path";
import { setDirectiveAttr } from "./attrBag";
import { pressTo, stateOf } from "./blocks/lifecycleState";

// THE LAST LINK A PRESS WALKS. The control was proven in jsdom (it calls setAttr with the leaf's
// line and the right pairs) and the plan was proven pure. What this closes is the join: hand the
// real writer a document and the plan a press would make, and read back a leaf the shell's own
// derivation would then put on the target station. Nothing here writes to disk.
//
// A FIXTURE LEAF, NOT THE LIVE DOCUMENT. The first version of this read RFC-075 off disk and
// asserted against its real leaf — which breaks the moment he presses a station in the window, and
// it did: he pressed `retired`, the leaf grew `retired=`, and a test that tried to set it got null
// back for "no change". A test that fails because the user used the feature is a bad test. The real
// document still proves the LINE-ADDRESSING half below, where its content does not matter.
const FILE = path.join(__dirname, "../../../RFCs/RFC-075-a-claim-carries-its-proof.md");
const REAL = fs.readFileSync(FILE, "utf8");
const REAL_LEAF = REAL.split("\n").findIndex((l) => /^::rfc\{/.test(l)) + 1;

// the fixture: a document shaped like a real one, with a leaf on line 3 and prose around it
const SRC = ["# A design", "", "::rfc{id=RFC-TEST}", "", "Body text that must not move.", ""].join("\n");
const LEAF = 3;

// The shell's own reading of a leaf, mirrored: it looks for settled=/retired= on the leaf line and
// a `## STATUS` heading in the body. Mirrored rather than imported because the shell is CommonJS in
// another repo — and the mirror is small enough to read at a glance.
const deriveFrom = (src) => {
  const leaf = src.split("\n")[LEAF - 1] || "";
  const has = (k) => new RegExp(`\\b${k}=([^\\s}]+)`).test(leaf);
  return {
    verdict: "approved",
    built: true,
    ...(has("settled") ? { settled: true } : {}),
    ...(has("retired") ? { retired: true } : {}),
  };
};

describe("a press on a station, walked all the way to the document", () => {
  it("the fixture's leaf is where the test says it is", () => {
    expect(SRC.split("\n")[LEAF - 1]).toBe("::rfc{id=RFC-TEST}");
  });

  // The REAL document is still used for the one thing its content cannot break: the writer must
  // find a leaf by line number in a 900-line file and touch nothing else.
  it("finds the real document's leaf by line, whatever state he has pressed it into", () => {
    expect(REAL_LEAF).toBeGreaterThan(0);
    expect(REAL.split("\n")[REAL_LEAF - 1]).toMatch(/^::rfc\{id=RFC-075/);
    const next = setDirectiveAttr(REAL, REAL_LEAF, "someAttrNobodyUses", "1");
    const a = REAL.split("\n");
    const b = next.split("\n");
    expect(b.length).toBe(a.length);
    expect(a.map((l, i) => (l === b[i] ? null : i + 1)).filter(Boolean)).toEqual([REAL_LEAF]);
  });

  it("built → settled: the plan's attributes land on the leaf, and the state follows", () => {
    const from = { state: { verdict: "approved", built: true } };
    const plan = pressTo("rfc", "settled", from, "2026-10-27");
    expect(plan.ok).toBe(true);
    let next = SRC;
    for (const [k, v] of Object.entries(plan.attrs)) {
      const n = setDirectiveAttr(next, LEAF, k, v);
      if (n != null) next = n;
    }
    expect(next.split("\n")[LEAF - 1]).toMatch(/settled=2026-10-27/);
    expect(stateOf("rfc", { state: deriveFrom(next) })).toBe("settled");
  });

  it("settled → built: clearing the declaration really removes it from the leaf", () => {
    const withSettled = setDirectiveAttr(SRC, LEAF, "settled", "2026-10-27");
    expect(withSettled.split("\n")[LEAF - 1]).toMatch(/settled=/);
    const plan = pressTo("rfc", "built", { state: { verdict: "approved", built: true, settled: true } }, "2026-10-27");
    let next = withSettled;
    for (const [k, v] of Object.entries(plan.attrs)) {
      const n = setDirectiveAttr(next, LEAF, k, v);
      if (n != null) next = n;
    }
    expect(next.split("\n")[LEAF - 1]).not.toMatch(/settled=/);
    expect(stateOf("rfc", { state: deriveFrom(next) })).toBe("built");
  });

  it("the write touches the leaf line and nothing else", () => {
    const next = setDirectiveAttr(SRC, LEAF, "retired", "2026-10-27");
    const a = SRC.split("\n");
    const b = next.split("\n");
    expect(b.length).toBe(a.length);
    const moved = a.map((l, i) => (l === b[i] ? null : i + 1)).filter(Boolean);
    expect(moved).toEqual([LEAF]);
  });
});

// THE TWO SCARS THE FUNCTION ALREADY CARRIES, now held by a test rather than a comment. Both were
// cases of the writer landing an attribute in the wrong place, found by reading the document
// afterwards — which is the expensive way to find it.
describe("the attribute bag — where the write must and must not land", () => {
  it("writes into the braces at the END of the line, never the first on it", () => {
    // A claim's label may quote a directive. Matching the first braces put a told= stamp INSIDE
    // two claims' inline code.
    const row = "::claim[Write `::rfc{id=RFC-1}` at the top]{id=c8}";
    const out = setDirectiveAttr(row, 1, "told", "systemview-test");
    expect(out).toBe("::claim[Write `::rfc{id=RFC-1}` at the top]{id=c8 told=systemview-test}");
  });

  it("does not match a key inside a QUOTED value", () => {
    // A claim whose note said "told= is the baseline" had the stamp written into the note's prose.
    const row = '::claim[x]{id=c1 note="told= is the baseline"}';
    const out = setDirectiveAttr(row, 1, "told", "me");
    expect(out).toBe('::claim[x]{id=c1 note="told= is the baseline" told=me}');
  });

  it("a null value REMOVES the attribute, so an un-answer looks unanswered", () => {
    const row = "::rfc{id=RFC-075 settled=2026-10-27}";
    expect(setDirectiveAttr(row, 1, "settled", null)).toBe("::rfc{id=RFC-075}");
  });

  it("removing the last attribute drops the braces rather than leaving {}", () => {
    expect(setDirectiveAttr("::rfc{settled=2026-10-27}", 1, "settled", null)).toBe("::rfc");
  });

  it("removing something that is not there changes nothing, and says so with null", () => {
    expect(setDirectiveAttr("::rfc{id=RFC-1}", 1, "settled", null)).toBe(null);
  });

  it("an empty value is QUOTED, because `members=` is not a directive at all", () => {
    expect(setDirectiveAttr("::members{who=a}", 1, "who", "")).toBe('::members{who=""}');
  });

  it("a value with spaces is quoted; a plain one is not", () => {
    expect(setDirectiveAttr("::rfc{id=R}", 1, "title", "a claim carries its proof")).toBe(
      '::rfc{id=R title="a claim carries its proof"}',
    );
    expect(setDirectiveAttr("::rfc{id=R}", 1, "settled", "2026-10-27")).toBe("::rfc{id=R settled=2026-10-27}");
  });

  it("a line with no braces at all grows them", () => {
    expect(setDirectiveAttr("::rfc", 1, "retired", "2026-10-27")).toBe("::rfc{retired=2026-10-27}");
  });

  it("a line off either end of the document is refused, not clamped", () => {
    expect(setDirectiveAttr("::rfc{id=R}", 0, "x", "1")).toBe(null);
    expect(setDirectiveAttr("::rfc{id=R}", 99, "x", "1")).toBe(null);
  });
});
