import { run, list, mark, subscribe, last, scopeOf, offerRunner, finished, clear } from "./proofsBus";
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

// ── THE RUN YOU CAN WATCH ───────────────────────────────────────────────────────────────────────
//
// `api/runTests.js` `executeSpecs` awaits every spec and returns when all of them are done, and
// there is no socket here to stream over — so one `runProofs` call could only ever produce one
// boolean, which `summaryOf` turned into the literal string "running…" for a run of any size. The
// hub's `document` scope already exists and the listing already names the documents in order, so
// the window asks for them one at a time. These claims are about that walk: that the marks fill in
// as it goes, that they are keyed so another surface can read them, and that nothing is left spun.

const DOCS = {
  projectCode: "sv",
  scope: { arc: "ARC-9" },
  specs: 3,
  documents: [
    { id: "D1", path: "a.md", specs: [{ kind: "run", line: 1 }] },
    { id: "D2", path: "b.md", specs: [{ kind: "run", line: 2 }, { kind: "run", line: 9 }] },
  ],
};
// THE HUB ANSWERS THE WHOLE SCOPE IN ONE REPLY — that is what `executeSpecs` has always done, and
// the bus now asks it exactly once. A `document`-scoped ask narrows the reply; anything wider gets
// all of it.
const ALL = [
  { passed: true, at: "a.md#L1" },
  { passed: true, at: "b.md#L2" },
  { passed: false, at: "b.md#L9" },
];
const ranFor = (doc) => {
  const tests = doc === "D1" ? ALL.slice(0, 1) : doc === "D2" ? ALL.slice(1) : ALL;
  return { passed: tests.filter((t) => t.passed).length, failed: tests.filter((t) => !t.passed).length, tests };
};

describe("ONE MOTION: the panel comes up, the specs go on the board, and the PANEL runs them", () => {
  it("DOES NOT OPEN THE SCRATCHPAD — the cards run whether it is visible or not, so opening it takes his screen for nothing", () => {
    const regions = [];
    const onOpen = (e) => regions.push(e.detail.region);
    window.addEventListener("sv:openRegion", onOpen);
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor() });
    run("sv", { arc: "ARC-9" });
    expect(regions).toEqual([]);
    window.removeEventListener("sv:openRegion", onOpen);
  });

  it("WITH A RUNNER ON SCREEN THE HUB IS NEVER ASKED — the panel's own cards ARE the run", async () => {
    const asked = [];
    hubWith({ listProofs: async () => DOCS, runProofs: async (a) => { asked.push(a); return ranFor(); } });
    const off = offerRunner(() => true);
    try {
      await run("sv", { arc: "ARC-9" });
      expect(asked).toEqual([]);
      // NOTHING IS PRE-PAINTED. A board of "queued" was a state the window never has — the cards
      // run one at a time and say so as each is reached, so until one does there is nothing to say.
      expect(last().marks).toEqual({});
      expect(last().running).toBe(true);
    } finally {
      off();
    }
  });

  it("the cards settle it ONE AT A TIME — that is the whole of the progress, and nothing orchestrates it", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor() });
    const off = offerRunner(() => true);
    try {
      await run("sv", { arc: "ARC-9" });

      mark({ "a.md#L1": "running" });
      expect(last().marks["a.md#L1"]).toBe("running");
      expect(last().marks["b.md#L2"]).toBeUndefined(); // the rest have not had their turn
      expect(last().running).toBe(true);

      mark({ "a.md#L1": "pass" });
      mark({ "b.md#L2": "running" });
      mark({ "b.md#L2": "pass" });
      mark({ "b.md#L9": "running" });
      mark({ "b.md#L9": "fail" });
      // THE RUN IS OVER BECAUSE NOTHING IS MOVING, not because anybody announced it. A runner that
      // forgets to say "done" — or dies — used to leave the button on "running" over a settled board.
      expect(last().running).toBe(false);
      expect(last().marks).toEqual({ "a.md#L1": "pass", "b.md#L2": "pass", "b.md#L9": "fail" });
    } finally {
      off();
    }
  });

  it("a runner saying done is still honoured — a scope with nothing runnable in it never marks anything", async () => {
    hubWith({ listProofs: async () => ({ ...DOCS, documents: [] }), runProofs: async () => ranFor() });
    const off = offerRunner(() => true);
    try {
      await run("sv", { arc: "ARC-9" });
      expect(last().running).toBe(true);
      finished(last().ask);
      expect(last().running).toBe(false);
    } finally {
      off();
    }
  });

  it("a stale runner cannot end a run that replaced it", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor() });
    const off = offerRunner(() => true);
    try {
      await run("sv", { arc: "ARC-9" });
      const old = last().ask;
      await run("sv", { document: "D1" });
      finished(old);
      expect(last().running).toBe(true);
    } finally {
      off();
    }
  });

  it("NO RUNNER ON SCREEN and the hub runs it — a press from a page with no panel must still do something", async () => {
    const asked = [];
    hubWith({ listProofs: async () => DOCS, runProofs: async (a) => { asked.push(a); return ranFor(); } });
    await run("sv", { arc: "ARC-9" });
    expect(asked).toEqual([{ projectCode: "sv", arc: "ARC-9" }]);
    expect(last().marks).toEqual({ "a.md#L1": "pass", "b.md#L2": "pass", "b.md#L9": "fail" });
    expect(last().running).toBe(false);
  });

  it("the hub fallback asks ONCE for the whole scope — a document at a time was round trips bought for an animation", async () => {
    const asked = [];
    hubWith({ listProofs: async () => DOCS, runProofs: async (a) => { asked.push(a); return ranFor(); } });
    await run("sv", { arc: "ARC-9" });
    // DOCS holds two documents. The walk this replaced would have asked twice.
    expect(asked).toHaveLength(1);
  });

  it("a spec the hub answer never mentioned carries NO mark — not run is an absence, never a verdict", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor("D2") });
    await run("sv", { arc: "ARC-9" });
    expect(last().marks["a.md#L1"]).toBeUndefined();
    expect(last().marks["b.md#L9"]).toBe("fail");
    expect(last().running).toBe(false);
  });

  it("a spec that could not be BUILT is settled too, by the problem that names it", async () => {
    hubWith({
      listProofs: async () => ({ ...DOCS, documents: [DOCS.documents[0]] }),
      runProofs: async () => ({ tests: [], problems: [{ document: "D1", line: 1, problem: "nothing to build" }] }),
    });
    await run("sv", { document: "D1" });
    expect(last().marks["a.md#L1"]).toBe("fail");
  });

  it("a hub that refuses settles every spec rather than leaving the board moving", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => { throw new Error("no connected services"); } });
    await run("sv", { arc: "ARC-9" });
    expect(last().ran.error).toContain("no connected services");
    expect(Object.values(last().marks).every((v) => v === "fail")).toBe(true);
    expect(last().running).toBe(false);
  });

  it("a second run CLEARS the first one's marks — two stories on one surface is no surface", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor() });
    const off = offerRunner(() => true);
    try {
      await run("sv", { arc: "ARC-9" });
      mark({ "b.md#L9": "fail" });
      await run("sv", { document: "D1" });
      expect(last().marks).toEqual({}); // wiped by the run that replaced it, never carried over
    } finally {
      off();
    }
  });

  it("a failed collect does not refuse the run — the cards are lost, the run is not", async () => {
    const asked = [];
    hubWith({
      listProofs: async () => { throw new Error("hub blinked"); },
      runProofs: async (a) => { asked.push(a); return RAN; },
    });
    const ran = await run("sv", { arc: "ARC-9" });
    expect(asked).toEqual([{ projectCode: "sv", arc: "ARC-9" }]);
    expect(ran.tests).toHaveLength(1);
    expect(last().running).toBe(false);
  });
});

describe("mark — the door anything that runs a spec writes through", () => {
  it("WHOEVER RAN IT, ONE MAP. The proofs panel runs its cards window-side and told nobody", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor() });
    await run("sv", { arc: "ARC-9" }); // no runner on screen, so the hub settles them all
    const seen = [];
    const off = subscribe((s) => seen.push(s.marks));
    mark({ "b.md#L9": "running" });
    expect(seen[seen.length - 1]["b.md#L9"]).toBe("running");
    // and it does not disturb what else was on the board
    expect(seen[seen.length - 1]["a.md#L1"]).toBe("pass");
    mark({});
    expect(seen).toHaveLength(2); // an empty patch notifies nobody
    off();
  });
});

describe("clear — results come back off, and only the results", () => {
  it("WIPES THE MARKS so a green is never a stale one, and KEEPS the listing", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor() });
    await run("sv", { arc: "ARC-9" });
    expect(Object.keys(last().marks).length).toBe(3);

    clear();
    expect(last().marks).toEqual({});
    expect(last().ran).toBe(null);
    expect(last().running).toBe(false);
    // what is IN SCOPE did not change — only what happened to it
    expect(last().listed).not.toBe(null);
    expect(last().scope).toEqual({ arc: "ARC-9" });
  });

  it("RAISES A TOKEN THE CARDS WATCH — wiping the map is not enough, the panel holds its own results", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor() });
    await run("sv", { arc: "ARC-9" });
    const before = last().cleared;
    clear();
    expect(last().cleared).toBe(before + 1);
    // a counter, not a flag: two clears in a row are two events and the second is not swallowed
    clear();
    expect(last().cleared).toBe(before + 2);
  });

  it("tells every surface at once — the panel's Clear and a document's ledger read one map", async () => {
    hubWith({ listProofs: async () => DOCS, runProofs: async () => ranFor() });
    await run("sv", { arc: "ARC-9" });
    const seen = [];
    const off = subscribe((s) => seen.push(s.marks));
    clear();
    expect(seen[seen.length - 1]).toEqual({});
    off();
  });
});
