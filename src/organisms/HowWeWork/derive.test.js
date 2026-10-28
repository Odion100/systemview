import { deriveArc, objectiveState, pressLine } from "./derive";

const O = (id, settled = []) => ({
  id,
  plans: settled.map((s, i) => ({ id: `RFC-${i}`, settled: s })),
});

describe("objectiveState — an objective is complete when every plan attached to it is settled", () => {
  it("counts the settled plans and says whether it is planned at all", () => {
    expect(objectiveState(O("O1", [true, false]))).toMatchObject({
      total: 2,
      settled: 1,
      planned: true,
      complete: false,
    });
  });
  it("is complete only when every plan is settled", () => {
    expect(objectiveState(O("O1", [true, true])).complete).toBe(true);
  });
  // THE VACUOUS PASS, which is the whole reason the floor exists: `[].every(settled)` is true, so
  // without the `total > 0` term an objective nobody ever planned reads complete and an arc with
  // five empty objectives takes the whole trail for free.
  it("an objective with NO plan is incomplete, not merely un-planned", () => {
    expect(objectiveState(O("O3", []))).toMatchObject({ total: 0, planned: false, complete: false });
  });
});

describe("deriveArc — the state flows upward, and nothing about it is pressed", () => {
  it("one unplanned objective holds the arc at approved, and names it", () => {
    const arc = deriveArc([O("O1", [true]), O("O2", [])]);
    expect(arc.station).toBe("approved");
    expect(arc.why).toContain("O2");
    expect(arc.why).toContain("no plan");
  });
  it("every objective planned but a plan still moving is inProgress, and it counts what is left", () => {
    const arc = deriveArc([O("O1", [true, false]), O("O2", [true])]);
    expect(arc.station).toBe("inProgress");
    expect(arc.why).toContain("1 plan is");
  });
  it("every plan settled settles the arc — derived upward, never pressed", () => {
    const arc = deriveArc([O("O1", [true, true]), O("O2", [true])]);
    expect(arc.station).toBe("settled");
    expect(arc.complete).toBe(2);
  });
  it("un-settling one plan takes the arc back off settled", () => {
    expect(deriveArc([O("O1", [true, true]), O("O2", [false])]).station).toBe("inProgress");
  });
  it("an empty arc is NOT settled — the floor, said out loud rather than passing vacuously", () => {
    const arc = deriveArc([]);
    expect(arc.station).toBe("approved");
    expect(arc.why).toContain("empty");
  });
  it("reports each objective's own count, which is what the demo draws", () => {
    const arc = deriveArc([O("O1", [true, false, false])]);
    expect(arc.objectives[0]).toMatchObject({ total: 3, settled: 1 });
    expect(arc.planned).toBe(1);
    expect(arc.complete).toBe(0);
  });
});

describe("pressLine — a station a press cannot write says what is missing", () => {
  it("a pressable station reads exactly as written", () => {
    expect(pressLine({ pressable: true, press: "Backward clears the verdicts." })).toBe(
      "Backward clears the verdicts."
    );
  });
  it("an unpressable one gets the reason appended rather than a dead control", () => {
    expect(pressLine({ pressable: false, press: "Nothing to press." })).toContain("cannot fake");
  });
  it("no station at all is an empty line, never a crash", () => {
    expect(pressLine(null)).toBe("");
  });
});
