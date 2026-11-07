import { TRAILS, stepsFor } from "../../atoms/Markdown/blocks/lifecycleState";
import { parseRetain } from "../../atoms/Markdown/blocks/retention";
import { CHAIN, LAYERS, LEAVES, LIFECYCLES, REASONS, STAGES, SUBTYPES } from "./howWeWork.data";

// THE PAGE'S CONTENT IS DATA, so the things that would make it lie are checkable. Two kinds of
// check here: the shape the renderer depends on, and the DRIFT against the code's own definition.

describe("the page's content has the shape the page renders", () => {
  it("every kind draws a trail, and every station carries all four answers", () => {
    expect(LIFECYCLES.map((l) => l.kind)).toEqual(["arc", "rfc", "gap", "report"]);
    LIFECYCLES.forEach((l) => {
      expect(l.stations.length).toBeGreaterThan(1);
      const ids = l.stations.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      l.stations.forEach((s) => {
        ["reads", "moves", "press", "means"].forEach((k) => {
          expect(typeof s[k]).toBe("string");
          // 12, not 20: a first station's trigger is honestly "it starts here".
          expect(s[k].length).toBeGreaterThan(12);
        });
        expect(typeof s.pressable).toBe("boolean");
      });
    });
  });

  // Retirement is reachable from anywhere on three of the kinds and is always the last station
  // drawn — a trail whose end was not `retired` would be a picture of a lifecycle that cannot end.
  it("every trail ends at retired", () => {
    LIFECYCLES.forEach((l) => expect(l.stations[l.stations.length - 1].id).toBe("retired"));
  });

  // EVERY KIND THAT CAN BE DECLINED FORKS, and the fork is always `rejected` — drawn as a real
  // destination rather than a failure to reach the road beside it. A report is the one kind that
  // cannot: it is a view, so it only ages.
  it("the three decidable kinds fork, and the fork is always rejected", () => {
    const forks = LIFECYCLES.flatMap((l) => l.stations.filter((s) => s.fork).map((s) => `${l.kind}:${s.id}`));
    expect(forks).toEqual(["arc:rejected", "rfc:rejected", "gap:rejected"]);
  });

  it("a retirement reason is an ending or a pause, and the list is closed", () => {
    expect(REASONS.map((r) => r.word).sort()).toEqual([
      "cancelled",
      "out of service",
      "shelf",
      "sideline",
      "superseded",
    ]);
    REASONS.forEach((r) => expect(["ending", "pause"]).toContain(r.group));
  });

  // THE ASYMMETRY THAT IS NOT AN OVERSIGHT, and the reason this check is loose where the one above
  // it is exact: a retirement REASON must be a closed list because conditions branch on it, and a
  // report SUBTYPE must be open because nothing branches on it — it only picks which fact may end
  // the document. So a test that pinned the subtypes exactly would be asserting the opposite of
  // what the design says. Contains, never equals.
  it("the report subtypes each answer what done means, and the vocabulary stays open", () => {
    expect(SUBTYPES.map((s) => s.as)).toEqual(
      expect.arrayContaining(["planning", "audit", "account", "brief", "spec"])
    );
    SUBTYPES.forEach((s) => expect(s.done.length).toBeGreaterThan(10));
  });

  // A WINDOW IS BOUNDED, AND THE BOUND IS WHAT STOPS A REPORT BECOMING FURNITURE. There is no
  // default `retain=` in the system (a leaf without one registers `invalid — no retention`), so
  // this column is the only statement anywhere of what a useful window is, and it is checked rather
  // than admired: every entry must be a window the PARSER can read, and none may reach past 30 days.
  //
  // THE CEILING IS 30 DAYS BECAUSE THE WINDOW ANSWERS HOW LONG SOMETHING COULD BE EVIDENCE — a
  // month is where the tree has moved far enough that an account is describing code that no longer
  // exists. Shorter is still right for everything whose successor is durable; what the bound
  // protects against is the other direction, a subtype quietly claiming the life of a document.
  //
  // `permanent` is deliberately not allowed here. It parses — and it is exactly the answer this
  // table exists to stop a subtype from supplying.
  it("every subtype names a bounded window the parser can read, and nothing reaches past 30 days", () => {
    const CEILING = 30 * 86400000;
    SUBTYPES.forEach((s) => {
      const ms = parseRetain(s.retain);
      expect(typeof ms).toBe("number"); // not undefined (undeclared) and not null (permanent)
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(CEILING);
    });
  });

  // SHORT IS THE REVERSIBLE CHOICE and the column has to say why, not just how long — a number with
  // no reason beside it is the next thing somebody raises to 90d.
  it("each window carries the reason it is that short", () => {
    SUBTYPES.forEach((s) => expect(s.clock.length).toBeGreaterThan(20));
  });

  // THE TWO STATEMENTS OF ONE RULE MUST AGREE. `agents/AGENTS.md` states this table for the agents
  // that FILE reports; this page states it for him. They drifted once already — the agent guide's
  // leaf template read `as=account retain=3d` while this table said an account takes no clock at
  // all — so the windows are pinned to the exact set, here, where a change to either shows up.
  it("the windows are the ones the agent guide tells agents to reach for", () => {
    expect(SUBTYPES.reduce((m, s) => ({ ...m, [s.as]: s.retain }), {})).toEqual({
      audit: "7d",
      brief: "7d",
      planning: "7d",
      spec: "30d",
      account: "30d",
    });
  });

  it("every context layer is loaded, retrieved or pushed", () => {
    LAYERS.forEach((l) => expect(["loaded", "retrieved", "pushed"]).toContain(l.group));
    // All three groups are populated, or the stack teaches a two-way split that does not exist.
    ["loaded", "retrieved", "pushed"].forEach((g) =>
      expect(LAYERS.filter((l) => l.group === g).length).toBeGreaterThan(0)
    );
  });

  it("the flow, the leaves and the chain are each complete enough to render", () => {
    STAGES.forEach((s) => expect(s.leaf && s.artifact && s.body && s.note).toBeTruthy());
    expect(LEAVES.map((l) => l.kind)).toEqual(["arc", "rfc", "gap", "report"]);
    expect(CHAIN.map((c) => c.id)).toEqual(["event", "hook", "skill", "job", "account"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// THE DRIFT CHECK, and it is deliberately a FAILING-ON-PURPOSE tripwire rather than a loose match.
//
// `lifecycleState.js` is the code's one definition of the trails, and this page renders its own.
// A settled ruling outranks the code until the code catches up, so where the two are ALLOWED to
// differ the difference is pinned here with the reason it exists — and anything unpinned fails. A
// test that merely tolerated any difference would quietly let the page rot instead.
//
// Every kind agrees right now, so every exception is empty. One goes in when a ruling lands on one
// side before the other, and comes out when the other side catches up — which is the moment this
// test FAILS and tells whoever landed it which exception to delete.
const EXPECTED_DRIFT = {
  rfc: { pageOnly: [], codeOnly: [] },
  arc: { pageOnly: [], codeOnly: [] },
  gap: { pageOnly: [], codeOnly: [] },
  report: { pageOnly: [], codeOnly: [] },
};

// AGAINST WHAT THE CODE DRAWS, not against the pressable order. `stepsFor` is the drawing — forks
// included — and the page is a teaching copy of that picture. `TRAILS` is the order `pressTo` clears
// against and it deliberately holds no fork, so comparing the page to it reports a drift that is the
// design.
describe("the page against lifecycleState.js — one definition, and the gap is named", () => {
  LIFECYCLES.forEach((l) => {
    it(`${l.kind}: the difference from the code is exactly the pinned exception`, () => {
      const page = l.stations.map((s) => s.id);
      const code = stepsFor(l.kind, l.stations[0].id).steps;
      expect(code.length).toBeGreaterThan(1);
      expect({
        pageOnly: page.filter((s) => !code.includes(s)),
        codeOnly: code.filter((s) => !page.includes(s)),
      }).toEqual(EXPECTED_DRIFT[l.kind]);
    });
  });

  it("where they agree, they agree on the ORDER too", () => {
    LIFECYCLES.forEach((l) => {
      const code = stepsFor(l.kind, l.stations[0].id).steps;
      const shared = l.stations.map((s) => s.id).filter((s) => code.includes(s));
      expect(shared).toEqual(code.filter((s) => shared.includes(s)));
    });
  });

  // The fork is a drawing and never a step: a station between `approved` and `built` in the order
  // `pressTo` clears against would make approving an RFC unwrite the STATUS heading that means built.
  it("the pressable order carries no fork", () => {
    expect(TRAILS.rfc).not.toContain("rejected");
    expect(TRAILS.arc).not.toContain("rejected");
  });
});
