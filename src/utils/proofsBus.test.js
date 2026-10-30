import { run, list, subscribe, last, scopeOf } from "./proofsBus";
import { setHub } from "./hub";

// THE BUS — one owner of a proofs run, whoever started it. What is worth pinning is the reason it
// exists at all: a run started from the arc diagram with the Proofs panel CLOSED has to still be
// there when the panel opens. An event pair could not do that, and this is the claim that says so.

const hubWith = (impl) => setHub({ Agent: impl, SystemView: {} });

const LISTED = { projectCode: "sv", scope: { arc: "ARC-9" }, specs: 1, documents: [{ id: "RFC-9", specs: [{ kind: "run", line: 3 }] }] };
const RAN = { projectCode: "sv", passed: 1, failed: 0, tests: [{ title: "t", passed: true, at: "RFC-9#L3" }] };

afterEach(() => setHub(null));

describe("scopeOf — the diagram's three menu targets are the hub's three scopes", () => {
  it("translates each one, in one place", () => {
    expect(scopeOf({ kind: "arc", id: "ARC-4" })).toEqual({ arc: "ARC-4" });
    expect(scopeOf({ kind: "objective", id: "ARC-4-O2" })).toEqual({ objective: "ARC-4-O2" });
    expect(scopeOf({ kind: "plan", id: "RFC-76" })).toEqual({ document: "RFC-76" });
  });

  it("an unknown target scopes to the whole project rather than to nothing", () => {
    expect(scopeOf({ kind: "mystery", id: "x" })).toEqual({});
    expect(scopeOf(null)).toEqual({});
  });
});

describe("a run is held, so a surface that was not watching can still see it", () => {
  it("THE PANEL-WAS-CLOSED CASE: subscribing after the run fires immediately with it", async () => {
    hubWith({ listProofs: async () => LISTED, runProofs: async () => RAN });
    await run("sv", { arc: "ARC-9" });

    // nobody was listening while that happened — exactly the diagram-with-the-panel-shut case
    const seen = [];
    const off = subscribe((s) => seen.push(s));
    expect(seen).toHaveLength(1);
    expect(seen[0].ran.tests).toHaveLength(1);
    expect(seen[0].running).toBe(false);
    off();
  });

  it("tells subscribers it started and then that it finished", async () => {
    hubWith({ listProofs: async () => LISTED, runProofs: async () => RAN });
    const seen = [];
    const off = subscribe((s) => seen.push({ running: s.running, ran: !!s.ran }));
    await run("sv", {});
    expect(seen.some((s) => s.running === true)).toBe(true);
    expect(seen[seen.length - 1]).toEqual({ running: false, ran: true });
    off();
  });

  it("a broken subscriber does not stop the others from hearing", async () => {
    hubWith({ listProofs: async () => LISTED, runProofs: async () => RAN });
    const off1 = subscribe(() => {
      throw new Error("I am a bad listener");
    });
    const heard = [];
    const off2 = subscribe((s) => heard.push(s));
    await run("sv", {});
    expect(heard.length).toBeGreaterThan(1);
    off1();
    off2();
  });

  it("unsubscribing stops delivery", async () => {
    hubWith({ listProofs: async () => LISTED, runProofs: async () => RAN });
    let n = 0;
    const off = subscribe(() => n++);
    off();
    const before = n;
    await run("sv", {});
    expect(n).toBe(before);
  });
});

describe("the later answer wins — a slow run cannot overwrite a fast one", () => {
  it("drops the first run's result when a second was started after it", async () => {
    let first = true;
    hubWith({
      listProofs: async () => LISTED,
      runProofs: async () => {
        if (first) {
          first = false;
          await new Promise((r) => setTimeout(r, 40));
          return { ...RAN, tests: [{ title: "SLOW", passed: true }] };
        }
        return { ...RAN, tests: [{ title: "FAST", passed: true }] };
      },
    });
    const slow = run("sv", { arc: "A" });
    await new Promise((r) => setTimeout(r, 5));
    await run("sv", { arc: "B" });
    await slow;
    expect(last().ran.tests[0].title).toBe("FAST");
    expect(last().running).toBe(false);
  });
});

describe("absence is stated, never spun on forever", () => {
  it("a hub with no proofs door answers with the reason and stops running", async () => {
    hubWith({});
    const r = await run("sv", {});
    expect(r.error).toMatch(/no proofs door/);
    expect(last().running).toBe(false);
  });

  it("list answers null rather than throwing when there is no door", async () => {
    hubWith({});
    await expect(list("sv", {})).resolves.toBe(null);
  });

  it("a hub that throws becomes a stated error, not a stuck run", async () => {
    hubWith({
      listProofs: async () => LISTED,
      runProofs: async () => {
        throw new Error("the service did not answer");
      },
    });
    const r = await run("sv", {});
    expect(r.error).toMatch(/did not answer/);
    expect(last().running).toBe(false);
  });

  // A FAILED LISTING IS NOT WORTH REFUSING THE RUN OVER — the run is the answer that matters, and
  // losing it because a count could not be fetched would be the tail wagging the dog.
  it("a listing that throws still lets the run through", async () => {
    hubWith({
      listProofs: async () => {
        throw new Error("no");
      },
      runProofs: async () => RAN,
    });
    const r = await run("sv", {});
    expect(r.tests).toHaveLength(1);
  });
});

describe("the scope the hub resolved is the one kept", () => {
  it("takes the scope off the listing rather than the request", async () => {
    hubWith({ listProofs: async () => ({ ...LISTED, scope: { arc: "ARC-9" } }), runProofs: async () => RAN });
    await run("sv", { arc: "arc-9" });
    expect(last().scope).toEqual({ arc: "ARC-9" });
  });
});
