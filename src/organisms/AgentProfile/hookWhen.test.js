import { WHEN_OPS, PRIOR_OPS, opsFor, takesWholeValue, needsValue, picks, seedVal, newWhenRow } from "./hookWhen";

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
    expect(["equals", "not", "was", "wasNot"].every(takesWholeValue)).toBe(true);
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
  // `was` / `was not` ARE THE ONLY CONDITIONAL OPERATORS, because they read a snapshot most events
  // do not carry. Offered where there is none, they are false forever — a hook that writes and
  // lists correctly and never fires, which is why the builder hides them AND the door refuses them.
  it("the prior pair is offered only where the event declares it carries one", () => {
    expect(opsFor({ prior: true }).map((o) => o.value)).toContain("was");
    expect(opsFor({}).map((o) => o.value)).not.toContain("was");
    expect(opsFor(null).map((o) => o.value)).not.toContain("wasNot");
  });

  it("and it sits beside `is not`, where a human looks for it — not at the end of the list", () => {
    const ops = opsFor({ prior: true }).map((o) => o.value);
    expect(ops.slice(0, 4)).toEqual(["equals", "not", "was", "wasNot"]);
    expect(ops.length).toBe(WHEN_OPS.length + PRIOR_OPS.length);
  });

  it("the prior pair picks too — asking what a field WAS is a whole-value question", () => {
    expect(picks(["arc", "rfc"], "was")).toBe(true);
    expect(picks(["arc", "rfc"], "wasNot")).toBe(true);
  });

  it("every offered operator is one the matcher knows", () => {
    const OPS = ["equals", "not", "contains", "startsWith", "endsWith", "matches", "in", "gt", "gte", "lt", "lte", "exists", "was", "wasNot"];
    for (const o of opsFor({ prior: true })) expect(OPS).toContain(o.value);
  });
});
