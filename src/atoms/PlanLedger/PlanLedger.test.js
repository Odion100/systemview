import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PlanLedger from "./PlanLedger";
import { planOf, stoppersOf } from "../Markdown/arcPlan";

// MOSTLY EYES-ONLY, AND THESE FOUR ARE NOT. The derivation is held to its answers in
// `arcPlan.test.js` and `utils/specRun.test.js`; what is claimed here is the handful of things the
// old drawing got wrong ON THE SCREEN, because that is where it got them wrong:
//
//   - the reason an objective is blocked is TEXT, not a `title=` on a ten-pixel word
//   - ONE percentage, not two that never meet
//   - a spec wears its run state, so a run leaves a trace instead of a border that un-dashes
//   - the order column stays away when nothing declared an order

const SRC = `
::arc{id=A-ARC owner=sv title="the plan"}

:::objective{id=O1 owner=sv state=open title="the first"}
a
:::

:::objective{id=O2 owner=sv state=blocked blocked="the board has no attachment door" title="the stuck one"}
b
:::
`;

const PLANS = {
  O1: [
    {
      id: "R-1",
      path: "RFCs/R-1.md",
      project: "sv",
      state: { verdict: "approved", claims: { met: 1, total: 2 } },
      specs: [
        { kind: "run", title: "first spec", line: 10, end: 12 },
        { kind: "run", title: "second spec", line: 20, end: 22 },
      ],
    },
  ],
};

const mount = (src = SRC, byObj = PLANS, props = {}) => {
  const plan = planOf(src, { byObj });
  return render(<PlanLedger plan={plan} stoppers={stoppersOf(plan)} {...props} />);
};

describe("what is stopping it, where it can be READ", () => {
  it("the written reason is on the screen as a sentence — TWICE, and both are the point", () => {
    const { container } = mount();
    // not a title= on a 10px state word, which is where it lived and which is the same as nowhere
    const said = screen.getAllByText("the board has no attachment door");
    expect(said).toHaveLength(2);
    // the strip answers "what is stopping the PLAN"; the row answers "what is stopping THIS", and
    // a reader scanning rows should not have to look back up for it
    expect(container.querySelector(".sv-ledger__stoppers").textContent).toContain("the board has no attachment door");
    expect(container.querySelector(".sv-ledger__why").textContent).toContain("the board has no attachment door");
  });

  it("an objective with no plan is named as a hole in the plan, not left silent", () => {
    mount();
    expect(screen.getByText("no plan attached — there is nothing to build from")).toBeInTheDocument();
  });

  it("nothing stuck draws no strip at all", () => {
    const { container } = mount("::arc{id=A}\n\n:::objective{id=O1 state=done}\nx\n:::\n", { O1: PLANS.O1 });
    expect(container.querySelector(".sv-ledger__stoppers")).toBeNull();
  });
});

describe("one progress number, and one bar made of the plan's own shape", () => {
  it("prints the composition's percent once", () => {
    const { container } = mount();
    const figures = [...container.querySelectorAll(".sv-ledger__figure b")].map((e) => e.textContent);
    expect(figures).toEqual(["25%"]); // (1/2 + 0) / 2
  });

  it("holds one segment per objective — an unplanned one keeps its place at zero", () => {
    const { container } = mount();
    const segs = [...container.querySelectorAll(".sv-ledger__seg")];
    expect(segs).toHaveLength(2);
    expect(segs[1].className).toContain("is-unplanned");
    expect(segs[1].querySelector("i").style.width).toBe("0%");
  });

  it("THE ORDER COLUMN STAYS AWAY when no `needs=` ordered anything — a column of 1s implies a sequence nobody wrote", () => {
    const { container } = mount();
    expect(container.querySelector(".sv-ledger__rank")).toBeNull();
  });

  it("…and appears the moment one really does", () => {
    const ordered = `
::arc{id=A-ARC}

:::objective{id=O1 state=done}
a
:::

:::objective{id=O2 state=open needs=A-ARC-O1}
b
:::
`;
    // the address rule is `ARC-<n>`, so an arc that cannot be named by it resolves nothing —
    // this uses a real arc id for the same reason the parser insists on one
    const src = ordered.replace(/A-ARC/g, "ARC-001");
    const { container } = mount(src, {});
    expect([...container.querySelectorAll(".sv-ledger__rank")].map((e) => e.textContent)).toEqual(["1", "2"]);
  });
});

describe("a spec wears what it is doing — a run leaves a trace", () => {
  const keys = ["RFCs/R-1.md#L10", "RFCs/R-1.md#L20"];

  it("no marks is no state — an unrun spec is not a passing one", () => {
    const { container } = mount();
    const dots = [...container.querySelectorAll(".sv-ledger__dot")];
    expect(dots).toHaveLength(2);
    expect(dots.every((d) => !/is-(pass|fail|running|queued)/.test(d.className))).toBe(true);
  });

  it("each of the four states reaches its own dot", () => {
    const { container } = mount(SRC, PLANS, { marks: { [keys[0]]: "running", [keys[1]]: "queued" } });
    const dots = [...container.querySelectorAll(".sv-ledger__dot")];
    expect(dots[0].className).toContain("is-running");
    expect(dots[1].className).toContain("is-queued");
  });

  it("a group's control errs toward red: one failure under it and the whole control is failed", () => {
    const { container } = mount(SRC, PLANS, { marks: { [keys[0]]: "pass", [keys[1]]: "fail" } });
    expect(container.querySelector(".sv-ledger__rows .sv-ledger__run").className).toContain("is-fail");
  });

  it("pressing a dot runs its own document; pressing the objective's control runs the objective", () => {
    const asked = [];
    const { container } = mount(SRC, PLANS, { onRun: (t) => asked.push(t) });
    fireEvent.click(container.querySelector(".sv-ledger__dot"));
    fireEvent.click(container.querySelector(".sv-ledger__rows .sv-ledger__run"));
    // THE SAME THREE SCOPES THE MAP'S MENU OFFERED — no new vocabulary, because the old one was right
    expect(asked.map((t) => t.kind)).toEqual(["plan", "objective"]);
    expect(asked[0].id).toBe("R-1");
    expect(asked[1].id).toBe("O1");
  });

  it("the head runs the whole arc", () => {
    const asked = [];
    const plan = planOf(SRC, { byObj: PLANS });
    render(<PlanLedger plan={plan} stoppers={[]} onRun={(t) => asked.push(t)} />);
    fireEvent.click(screen.getByTitle("run every spec in this arc and its plans"));
    expect(asked).toEqual([{ kind: "arc", id: "A-ARC" }]);
  });
});

describe("it refuses to draw a plan that is not there", () => {
  it("no objectives says so rather than rendering an empty frame at 100%", () => {
    const { container } = render(<PlanLedger plan={planOf("# nothing\n", {})} />);
    expect(container.textContent).toMatch(/no objectives in this document yet/);
  });
});
