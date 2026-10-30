import { planOf, stoppersOf, waitLabel } from "./arcPlan";

// WHERE THE PLAN IS, AND WHAT IS STOPPING IT. The claims go on the DERIVATION, not on the render:
// the counting, the ordering and the reason a thing is stuck are where this can be wrong, and the
// pixels are eyes-only on any day.

const rfc = (id, obj, met, total, extra = {}) => ({
  id,
  kind: "rfc",
  path: `RFCs/${id}.md`,
  project: "sv",
  arc: obj,
  state: { verdict: "approved", claims: { met, total } },
  specs: [{ kind: "run", line: 10 }],
  ...extra,
});

const byObjOf = (rows) => {
  const m = new Map();
  rows.forEach((r) => {
    const o = r.arc.slice(r.arc.lastIndexOf("-O") + 1);
    m.set(o, [...(m.get(o) || []), r]);
  });
  return m;
};

// MOCK-ARC as the live fixture really is (measured off the hub's registry, 2026-10-30): seven
// objectives, five of them planned, one blocked and unplanned, 5 of 16 claims met.
const MOCK = `
::arc{id=MOCK-ARC owner=sv title="MOCK"}

:::objective{id=O1 owner=sv state=open title="The half mock-rfc serves"}
a
:::

:::objective{id=O2 owner=sv state=open title="The half mock-plan serves"}
b
:::

:::objective{id=O3 owner=sv state=done title="Two plans serve one objective"}
c
:::

:::objective{id=O4 owner=sv state=doing title="An objective mid-flight"}
d
:::

:::objective{id=O5 owner=sv state=open title="Planned but untouched"}
e
:::

:::objective{id=O6 owner=sv state=blocked blocked="waiting on a decision only the walk can fake" title="A blocked objective"}
f
:::

:::objective{id=O7 owner=sv state=open title="The one that makes the second row"}
g
:::
`;

const MOCK_PLANS = byObjOf([
  rfc("MOCK-RFC", "MOCK-ARC-O1", 2, 6),
  rfc("MOCK-PLAN", "MOCK-ARC-O2", 1, 1),
  rfc("MOCK-RFC-2", "MOCK-ARC-O3", 2, 2),
  rfc("MOCK-RFC-3", "MOCK-ARC-O3", 0, 2),
  rfc("MOCK-RFC-4", "MOCK-ARC-O4", 0, 3),
  rfc("MOCK-RFC-5", "MOCK-ARC-O5", 0, 2),
]);

describe("one composition, so the two progress numbers cannot disagree", () => {
  it("counts objectives and claims off the SAME rows", () => {
    const { totals } = planOf(MOCK, { byObj: MOCK_PLANS });
    expect(totals.objectives).toBe(7);
    expect(totals.complete).toBe(1);
    expect(totals.doing).toBe(1);
    expect(totals.blocked).toBe(1);
    // the number the chips used to sum to, 200px away from the header's own
    expect(totals.claims).toEqual({ met: 5, total: 16 });
    expect(totals.specs).toBe(6);
  });

  it("the percent IS the bar's ink — the mean of the per-objective fills, nothing else", () => {
    const p = planOf(MOCK, { byObj: MOCK_PLANS });
    const mean = p.objectives.reduce((n, o) => n + o.fraction, 0) / p.objectives.length;
    expect(p.totals.pct).toBe(Math.round(mean * 100));
    // 2/6 + 1/1 + done + 0 + 0 + 0 + 0, over seven
    expect(p.totals.pct).toBe(33);
  });

  it("an unplanned objective is INCOMPLETE, never absent — it holds its segment at zero", () => {
    const p = planOf(MOCK, { byObj: MOCK_PLANS });
    const o6 = p.objectives.find((o) => o.id === "O6");
    expect(o6.unplanned).toBe(true);
    expect(o6.fraction).toBe(0);
    expect(p.totals.unplanned).toBe(2); // O6 and O7
  });

  it("marked done reads full however few claims its plans agreed — the press is a person's word", () => {
    const o3 = planOf(MOCK, { byObj: MOCK_PLANS }).objectives.find((o) => o.id === "O3");
    expect(o3.claims).toEqual({ met: 2, total: 4 });
    expect(o3.fraction).toBe(1);
  });

  it("names the frontier: every claim met and still not marked done", () => {
    const p = planOf(MOCK, { byObj: MOCK_PLANS });
    expect(p.objectives.filter((o) => o.ready).map((o) => o.id)).toEqual(["O2"]);
    expect(p.totals.ready).toBe(1);
  });

  it("a plan with no claims is UNCLAIMED, which is not the same as no work done", () => {
    const plans = byObjOf([rfc("R-1", "A-O1", 0, 0)]);
    const src = "::arc{id=A}\n\n:::objective{id=O1 state=open}\nx\n:::\n";
    const [o] = planOf(src, { byObj: plans }).objectives;
    expect(o.unclaimed).toBe(true);
    expect(o.unplanned).toBe(false);
    expect(o.fraction).toBe(0);
  });

  it("no objectives at all is an empty plan, not a throw and not 100%", () => {
    const p = planOf("# nothing\n", {});
    expect(p.objectives).toEqual([]);
    expect(p.totals.pct).toBe(0);
    expect(p.arc).toBe(null);
  });
});

describe("what is stopping it, in words a reader can read", () => {
  const DEPS = `
::arc{id=ARC-001 owner=sv}

:::objective{id=O1 state=done}
a
:::

:::objective{id=O2 state=open needs=ARC-001-O1}
b
:::

:::objective{id=O3 state=doing needs=ARC-001-O2}
c
:::

:::objective{id=O4 state=blocked blocked="the board has no attachment door" needs=ARC-001-O9}
d
:::

:::objective{id=O5 state=open needs=autobot/ARC-002-O1}
e
:::
`;

  it("the blocked reason is a field, not a hover", () => {
    const o4 = planOf(DEPS, {}).objectives.find((o) => o.id === "O4");
    expect(o4.because).toBe("the board has no attachment door");
  });

  it("a met dependency stops being a blocker — only what is still in the way is carried", () => {
    const o2 = planOf(DEPS, {}).objectives.find((o) => o.id === "O2");
    expect(o2.waits).toEqual([]);
  });

  it("an unmet dependency says which objective, and offers it as somewhere to jump", () => {
    const o3 = planOf(DEPS, {}).objectives.find((o) => o.id === "O3");
    expect(o3.waits).toEqual([{ kind: "waiting", to: "O2", text: "waits on O2" }]);
  });

  it("an address this document cannot see SAYS SO rather than reading as no dependency", () => {
    const p = planOf(DEPS, {});
    expect(p.objectives.find((o) => o.id === "O4").waits[0]).toEqual({
      kind: "unresolved",
      to: "",
      text: "needs ARC-001-O9 — nothing here answers to it",
    });
    expect(p.objectives.find((o) => o.id === "O5").waits[0]).toEqual({
      kind: "elsewhere",
      to: "",
      text: "waits on autobot/ARC-002-O1 — another project",
    });
  });

  it("waitLabel is the one place a dependency is phrased", () => {
    expect(waitLabel({ status: "waiting", objective: "O1" }).text).toBe("waits on O1");
    expect(waitLabel({}).kind).toBe("unresolved");
  });
});

describe("the order the system already computed, finally read", () => {
  it("ARC-001's three real edges become three ranks", () => {
    const src = `
::arc{id=ARC-001 owner=sv}

:::objective{id=O1 state=done}
a
:::

:::objective{id=O2 state=done needs=ARC-001-O1}
b
:::

:::objective{id=O3 state=doing needs=ARC-001-O1}
c
:::

:::objective{id=O4 state=done}
d
:::

:::objective{id=O5 state=blocked needs=ARC-001-O4}
e
:::
`;
    const p = planOf(src, {});
    const rankOf = (id) => p.objectives.find((o) => o.id === id).rank;
    expect(rankOf("O1")).toBe(1);
    expect(rankOf("O4")).toBe(1);
    expect(rankOf("O2")).toBe(2);
    expect(rankOf("O3")).toBe(2);
    expect(rankOf("O5")).toBe(2);
    expect(p.totals.ordered).toBe(true);
  });

  it("DEGRADES HONESTLY: most arcs declare no needs at all, so nothing claims to be ordered", () => {
    const p = planOf(MOCK, { byObj: MOCK_PLANS });
    expect(p.objectives.every((o) => o.rank === 1)).toBe(true);
    expect(p.totals.ordered).toBe(false);
    // document order survives, so no objective moves for want of a dependency
    expect(p.objectives.map((o) => o.id)).toEqual(["O1", "O2", "O3", "O4", "O5", "O6", "O7"]);
  });

  it("a cycle is FLAGGED and emitted, never dropped — an absent objective reads as no such work", () => {
    const src = `
::arc{id=ARC-009 owner=sv}

:::objective{id=O1 state=open needs=ARC-009-O2}
a
:::

:::objective{id=O2 state=open needs=ARC-009-O1}
b
:::
`;
    const p = planOf(src, {});
    expect(p.objectives.map((o) => o.id)).toEqual(["O1", "O2"]);
    expect(p.objectives.every((o) => o.cycle)).toBe(true);
    expect(p.totals.cycle).toBe(true);
  });
});

describe("the arc's own line", () => {
  it("carries its station and its OWN specs — an arc document is collected like any other", () => {
    const arcRow = {
      id: "MOCK-ARC",
      state: { verdict: "approved", objectives: { total: 7, planned: 5, complete: 1 } },
      specs: [{ kind: "run", line: 121 }],
    };
    const p = planOf(MOCK, { byObj: MOCK_PLANS, arcRow });
    expect(p.arc.id).toBe("MOCK-ARC");
    expect(p.arc.station).toBe("approved");
    expect(p.arc.specs).toBe(1);
  });

  it("a plan chip carries its own station, claims and spec count", () => {
    const p = planOf(MOCK, { byObj: MOCK_PLANS });
    const o3 = p.objectives.find((o) => o.id === "O3");
    expect(o3.plans.map((x) => x.id)).toEqual(["MOCK-RFC-2", "MOCK-RFC-3"]);
    expect(o3.plans[0]).toMatchObject({ station: "approved", met: 2, total: 2, specs: 1, path: "RFCs/MOCK-RFC-2.md" });
  });

  it("takes plans from a plain object as happily as from a Map", () => {
    const src = "::arc{id=A}\n\n:::objective{id=O1 state=open}\nx\n:::\n";
    const p = planOf(src, { byObj: { O1: [rfc("R-1", "A-O1", 1, 2)] } });
    expect(p.objectives[0].plans).toHaveLength(1);
    expect(p.objectives[0].fraction).toBe(0.5);
  });
});

describe("what is stopping it — the half no surface ever answered", () => {
  const STUCK = `
::arc{id=ARC-007 owner=sv}

:::objective{id=O1 state=done}
a
:::

:::objective{id=O2 state=blocked blocked="the board has no attachment door" needs=ARC-007-O1}
b
:::

:::objective{id=O3 state=doing needs=ARC-007-O2}
c
:::

:::objective{id=O4 state=open needs=autobot/ARC-002-O1}
d
:::

:::objective{id=O5 state=open}
e
:::

:::objective{id=O6 state=done}
f
:::
`;

  it("WORST FIRST — a cycle, then a written block, then a dependency, then no plan at all", () => {
    const stoppers = stoppersOf(planOf(STUCK, {}));
    // four of the six objectives are live with no plan attached; the two marked done are not stuck
    expect(stoppers.map((s) => s.kind)).toEqual([
      "blocked",
      "waiting",
      "elsewhere",
      "unplanned",
      "unplanned",
      "unplanned",
      "unplanned",
    ]);
  });

  it("the written reason arrives VERBATIM — the document is the only store", () => {
    const [first] = stoppersOf(planOf(STUCK, {}));
    expect(first).toMatchObject({ id: "O2", kind: "blocked", text: "the board has no attachment door" });
  });

  it("`blocked` with nothing written says THAT, rather than an empty line", () => {
    const src = "::arc{id=A}\n\n:::objective{id=O1 state=blocked}\nx\n:::\n";
    const hit = stoppersOf(planOf(src, {})).find((s) => s.kind === "blocked");
    expect(hit.text).toBe("marked blocked, with no reason written down");
  });

  it("a dependency carries the objective to jump to; an address we cannot see carries none", () => {
    const stoppers = stoppersOf(planOf(STUCK, {}));
    expect(stoppers.find((s) => s.kind === "waiting")).toMatchObject({ id: "O3", text: "waits on O2", to: "O2" });
    expect(stoppers.find((s) => s.kind === "elsewhere")).toMatchObject({
      id: "O4",
      text: "waits on autobot/ARC-002-O1 — another project",
      to: "",
    });
  });

  it("AN OBJECTIVE MARKED DONE IS NOT STOPPED BY HAVING NO PLAN — that is finished work, not a hole", () => {
    const ids = stoppersOf(planOf(STUCK, {}))
      .filter((s) => s.kind === "unplanned")
      .map((s) => s.id);
    expect(ids).toEqual(["O2", "O3", "O4", "O5"]);
    expect(ids).not.toContain("O1"); // done, and never planned
    expect(ids).not.toContain("O6"); // same
  });

  it("a cycle is a stopper of its own, and the worst one", () => {
    const src = `
::arc{id=ARC-009}

:::objective{id=O1 state=open needs=ARC-009-O2}
a
:::

:::objective{id=O2 state=open needs=ARC-009-O1}
b
:::
`;
    const kinds = stoppersOf(planOf(src, {})).map((s) => s.kind);
    expect(kinds[0]).toBe("cycle");
    expect(kinds.filter((k) => k === "cycle")).toHaveLength(2);
  });

  it("NOTHING STUCK IS AN EMPTY LIST — a strip saying 'nothing is blocked' is furniture", () => {
    const src = "::arc{id=A}\n\n:::objective{id=O1 state=done}\nx\n:::\n";
    expect(stoppersOf(planOf(src, {}))).toEqual([]);
    expect(stoppersOf(null)).toEqual([]);
  });
});

describe("a spec is a thing you can watch, not only a number you can count", () => {
  it("every plan carries its specs with the key a RESULT is matched on", () => {
    const p = planOf(MOCK, { byObj: MOCK_PLANS });
    const [plan] = p.objectives.find((o) => o.id === "O1").plans;
    expect(plan.specs).toBe(1); // the count the chip has always shown
    expect(plan.specRows).toEqual([
      { key: "RFCs/MOCK-RFC.md#L10", line: 10, end: 10, kind: "run", name: "steps", claim: "", claimLine: 0 },
    ]);
  });

  it("a `::test` is a reference, so its label is the only name it has", () => {
    const row = rfc("R-1", "A-O1", 0, 0, { specs: [{ kind: "test", label: "Math.add", line: 4, end: 4 }] });
    const [plan] = planOf("::arc{id=A}\n\n:::objective{id=O1 state=open}\nx\n:::\n", { byObj: { O1: [row] } }).objectives[0]
      .plans;
    expect(plan.specRows[0].name).toBe("Math.add");
  });

  it("the arc's OWN specs come through the same way — it is a document, not a container", () => {
    const arcRow = { id: "MOCK-ARC", path: "RFCs/proofs/mock-arc.md", project: "sv", state: {}, specs: [{ kind: "run", title: "the arc's own spec", line: 121, end: 126 }] };
    const { arc } = planOf(MOCK, { byObj: MOCK_PLANS, arcRow });
    expect(arc.specRows).toEqual([
      { key: "RFCs/proofs/mock-arc.md#L121", line: 121, end: 126, kind: "run", name: "the arc's own spec", claim: "", claimLine: 0 },
    ]);
  });
});

describe("who has what, off the same rows as everything else", () => {
  it("rolls up by owner — most work first, then alphabetical, so a press cannot reshuffle it", () => {
    const src = `
::arc{id=A}

:::objective{id=O1 owner=sv state=done}
a
:::

:::objective{id=O2 owner=sv state=open}
b
:::

:::objective{id=O3 owner=autobot state=done}
c
:::

:::objective{id=O4 state=open}
d
:::
`;
    expect(planOf(src, {}).totals.byOwner).toEqual([
      { owner: "sv", total: 2, done: 1 },
      { owner: "autobot", total: 1, done: 1 },
      // an objective with nobody on it is a real row under a name that says it needs one
      { owner: "unowned", total: 1, done: 0 },
    ]);
  });
});
