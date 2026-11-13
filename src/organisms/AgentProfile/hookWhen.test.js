import { WHEN_OPS, takesWholeValue, needsValue, picks, seedVal, newWhenRow } from "./hookWhen";

// An event declares the values a field can take so nobody types a closed set from memory. The
// mechanism worked and was unreachable: a new row was born on `contains` while the picker drew only
// for `equals`, so every condition started as a text box.
describe("a when row reaches the values its event declared", () => {
  const KINDS = ["arc", "rfc", "report", "gap"];

  it("a new row is born on `is`, which is the only default under which a declared set is visible", () => {
    const row = newWhenRow([{ value: "docKind" }], () => KINDS);
    expect(row.op).toBe("equals");
    expect(picks(KINDS, row.op)).toBe(true);
  });

  it("…and it carries a real value, because a blank picker saves an empty condition", () => {
    expect(newWhenRow([{ value: "docKind" }], () => KINDS).val).toBe("arc");
  });

  it("a field with nothing declared starts empty — there is nothing to seed from", () => {
    expect(newWhenRow([{ value: "path" }], () => null).val).toBe("");
    expect(picks(null, "equals")).toBe(false);
  });

  // THE LINE BETWEEN A PICK AND A FRAGMENT. `equals`/`not` take the value whole, so the set is
  // exactly what they want; the string operators take a PART of it by definition, and offering
  // `gpu-process` as the thing to find inside `gpu-process` is a dropdown with one pointless answer.
  it("only the whole-value operators pick — a fragment operator keeps its text box", () => {
    expect(["equals", "not"].every(takesWholeValue)).toBe(true);
    expect(["contains", "startsWith", "endsWith", "matches", "gte", "lte", "exists"].some(takesWholeValue)).toBe(false);
  });

  it("`is not` is offered, and it picks too — excluding one member of a set is a whole-value question", () => {
    expect(WHEN_OPS.map((o) => o.value)).toContain("not");
    expect(picks(KINDS, "not")).toBe(true);
  });

  it("`exists` is the one operator with nothing to compare against", () => {
    expect(needsValue("exists")).toBe(false);
    expect(WHEN_OPS.filter((o) => !needsValue(o.value)).map((o) => o.value)).toEqual(["exists"]);
  });

  // A value somebody already chose or typed is theirs. Seeding is for the empty row only — a seed
  // that overwrote would silently rewrite a condition while they were editing the field beside it.
  it("seeding never overwrites a value that is already there", () => {
    expect(seedVal(KINDS, "equals", "gap")).toBe("gap");
    expect(seedVal(KINDS, "contains", "ga")).toBe("ga");
    expect(seedVal(KINDS, "equals", "")).toBe("arc");
    expect(seedVal(KINDS, "contains", "")).toBe("");
  });

  // Every operator the row offers must be one the matcher implements, or the hook lists correctly
  // and is false forever — the failure `checkWhen` exists to catch at the writing door.
  it("every offered operator is one the matcher knows", () => {
    const OPS = ["equals", "not", "contains", "startsWith", "endsWith", "matches", "in", "gt", "gte", "lt", "lte", "exists"];
    for (const o of WHEN_OPS) expect(OPS).toContain(o.value);
  });
});
