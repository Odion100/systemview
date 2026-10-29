import { TRAILS } from "../../atoms/Markdown/blocks/lifecycleState";
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

  // The gap is the only kind with TWO endings, and the page has to draw `rejected` as a real
  // destination rather than a failure to reach `resolved`.
  it("only the gap forks, and the fork is rejected", () => {
    const forks = LIFECYCLES.flatMap((l) => l.stations.filter((s) => s.fork).map((s) => `${l.kind}:${s.id}`));
    expect(forks).toEqual(["gap:rejected"]);
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
      expect.arrayContaining(["planning", "notice", "audit", "account", "brief", "spec"])
    );
    SUBTYPES.forEach((s) => expect(s.done.length).toBeGreaterThan(10));
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
// `lifecycleState.js` is the code's one definition of the trails. This page follows tonight's
// planning report (`meetings/2026-10-27-the-lifecycle-of-every-kind-we-register.md`), which is the
// current definition and OUTRANKS the code — and the code has not landed two of its rulings yet:
// an arc gaining the front half of the RFC trail (draft → approved → open → settled), and a gap
// forking to `rejected`. Those two are pinned below with their reason.
//
// So when the code catches up, this test FAILS and tells whoever landed it which exception to
// delete. A test that merely tolerated any difference would quietly let the page rot instead.
const EXPECTED_DRIFT = {
  rfc: { pageOnly: [], codeOnly: [] },
  // CLOSED 2026-10-28, by RFC-076 slice 5. The arc runs the approval flow and derives upward —
  // draft → approved → inProgress → settled → retired, with `settled` folded from the plans
  // attached to each objective. The page and the code agree, so the exception is deleted.
  arc: { pageOnly: [], codeOnly: [] },
  // CLOSED 2026-10-28, by RFC-076 slice 3. The gap's fork landed: `rejected` is a station in
  // `TRAILS.gap`, declared on the leaf with its reason, and `resolved` now needs a proof. The page
  // and the code agree about this kind, so the exception is deleted rather than relaxed — which is
  // what this tripwire exists to make somebody do.
  gap: { pageOnly: [], codeOnly: [] },
  report: { pageOnly: [], codeOnly: [] },
};

describe("the page against lifecycleState.js — one definition, and the gap is named", () => {
  LIFECYCLES.forEach((l) => {
    it(`${l.kind}: the difference from the code is exactly the one tonight's report ruled`, () => {
      const page = l.stations.map((s) => s.id);
      const code = TRAILS[l.kind];
      expect(code).toBeDefined();
      expect({
        pageOnly: page.filter((s) => !code.includes(s)),
        codeOnly: code.filter((s) => !page.includes(s)),
      }).toEqual(EXPECTED_DRIFT[l.kind]);
    });
  });

  it("where they agree, they agree on the ORDER too", () => {
    LIFECYCLES.forEach((l) => {
      const shared = l.stations.map((s) => s.id).filter((s) => TRAILS[l.kind].includes(s));
      expect(shared).toEqual(TRAILS[l.kind].filter((s) => shared.includes(s)));
    });
  });
});
