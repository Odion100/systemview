import { blankRow, condFields, offersFor, unitFor, valuesFor } from "./hookForm";

// The two threshold events as the harness declares them (autobot `electron/agents/hooks.cjs`), plus
// one that declares nothing — the generic case has to keep working, because most events are it.
const EVENTS = [
  { name: "idle", fields: ["quietMin"], values: { quietMin: [5, 10, 15, 30, 60] }, units: { quietMin: "min" } },
  {
    name: "usage",
    fields: ["pct", "snapshot"],
    values: { pct: [50, 60, 70], snapshot: [true, false] },
    units: { pct: "%" },
  },
  { name: "tool.call", fields: ["tool", "input.command"] },
];
const AMBIENT = [{ name: "page.opened" }];

describe("the hook form offers what the event declares", () => {
  it("reads fields off the event, with the ambient set after them", () => {
    expect(condFields(EVENTS, AMBIENT, "idle").map((f) => f.value)).toEqual(["quietMin", "page.opened"]);
    expect(condFields(EVENTS, AMBIENT, "page.opened").map((f) => f.value)).toEqual(["page.opened"]);
  });

  // HIS ASK, 2026-11-07: *"choose idle five minutes, and then choose fire rate per hour — there's
  // two variables here and I can't select the kind of times I want."* The second variable was
  // already a picker; this is the first one.
  it("a duration is SELECTED, in its own unit, for the threshold ops as well as for `is`", () => {
    expect(offersFor(EVENTS, "idle", "quietMin", "gte", "")).toEqual([
      { value: "5", label: "5 min" },
      { value: "10", label: "10 min" },
      { value: "15", label: "15 min" },
      { value: "30", label: "30 min" },
      { value: "60", label: "60 min" },
    ]);
    expect(offersFor(EVENTS, "idle", "quietMin", "lte", "")[0].label).toBe("5 min");
    expect(offersFor(EVENTS, "usage", "pct", "gte", "")[1].label).toBe("60 %");
    expect(unitFor(EVENTS, "usage", "pct")).toBe("%");
  });

  // A hook carrying a number nobody offered must survive being opened — editing the rate of a hook
  // that fires at 7 minutes may not quietly make it fire at 5.
  it("a value already on the hook rides into the list rather than being rounded away", () => {
    const opts = offersFor(EVENTS, "idle", "quietMin", "gte", "7");
    expect(opts[0]).toEqual({ value: "7", label: "7 min" });
    expect(opts).toHaveLength(6);
  });

  it("no offers for a field nothing declares, and none for the text ops — it stays a box", () => {
    expect(offersFor(EVENTS, "tool.call", "tool", "equals", "")).toBe(null);
    expect(offersFor(EVENTS, "idle", "quietMin", "contains", "")).toBe(null);
    expect(offersFor(EVENTS, "idle", "quietMin", "matches", "")).toBe(null);
    expect(valuesFor(EVENTS, "tool.call", "tool")).toBe(null);
  });

  // `contains 5` on a duration is a row nobody wanted; it was the default because the generic case
  // was the only case.
  it("a new row on a threshold event opens at ≥ with a real number in it", () => {
    expect(blankRow(EVENTS, AMBIENT, "idle")).toEqual({ field: "quietMin", op: "gte", val: "5" });
    expect(blankRow(EVENTS, AMBIENT, "usage")).toEqual({ field: "pct", op: "gte", val: "50" });
    expect(blankRow(EVENTS, AMBIENT, "tool.call")).toEqual({ field: "tool", op: "contains", val: "" });
  });

  // A non-numeric preset list (snapshot: true|false) is still offers, never a threshold default.
  it("a boolean field offers its two values and stays a `contains` row by default", () => {
    expect(offersFor(EVENTS, "usage", "snapshot", "equals", "").map((o) => o.label)).toEqual(["true", "false"]);
  });

  // THE CATALOG IS THE ONLY SOURCE. An empty one cannot throw, because the form renders before the
  // harness answers — and a window with no harness at all (a browser tab) never gets one.
  it("an absent catalog offers nothing and throws nothing", () => {
    expect(condFields([], [], "idle")).toEqual([]);
    expect(offersFor([], "idle", "quietMin", "gte", "")).toBe(null);
    expect(blankRow([], [], "idle")).toEqual({ field: "", op: "contains", val: "" });
    expect(unitFor(undefined, "idle", "quietMin")).toBe("");
  });
});
