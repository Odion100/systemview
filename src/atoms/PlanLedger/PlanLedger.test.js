import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PlanLedger from "./PlanLedger";

const spec = (key, over = {}) => ({ key, line: 10, end: 12, kind: "run", name: `spec ${key}`, claim: "", ...over });

const objective = (id, over = {}) => ({
  id,
  line: 7,
  title: `title of ${id}`,
  owner: "",
  state: "open",
  because: "",
  cycle: false,
  rank: 1,
  waits: [],
  claims: { met: 0, total: 0 },
  specs: 0,
  unplanned: false,
  fraction: 0,
  ready: false,
  unclaimed: false,
  plans: [],
  ...over,
});

const plan = (objectives, over = {}) => ({
  arc: { id: "ARC-9", title: "an arc", owner: "", station: "approved", specs: 0, path: "a.md", project: "p", specRows: [] },
  objectives,
  totals: {
    objectives: objectives.length,
    complete: objectives.filter((o) => o.state === "done").length,
    doing: 0,
    open: 0,
    blocked: 0,
    unplanned: 0,
    ready: 0,
    claims: { met: 0, total: 0 },
    specs: 0,
    byOwner: [],
    pct: 0,
    ordered: false,
    cycle: false,
    ...(over.totals || {}),
  },
  ...over,
});

describe("PlanLedger — where the plan is, and what is stopping it", () => {
  it("draws nothing at all without a plan, rather than an empty frame", () => {
    const { container } = render(<PlanLedger plan={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("states ONE percent, and the bar is that same number — two numbers is the bug it replaced", () => {
    const { container } = render(<PlanLedger plan={plan([objective("O1")], { totals: { pct: 42 } })} />);
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(container.querySelector(".pl__bar i").style.width).toBe("42%");
  });

  it("lists every objective in the order it was given — the document's order, not a severity sort", () => {
    const { container } = render(<PlanLedger plan={plan([objective("O3"), objective("O1"), objective("O2")])} />);
    expect([...container.querySelectorAll(".pl__row-id")].map((e) => e.textContent)).toEqual(["O3", "O1", "O2"]);
  });

  it("says WHY a row is stuck ON that row, in the sentence it was written in", () => {
    const stoppers = [{ id: "O2", title: "", kind: "blocked", text: "waiting on a decision only the walk can fake" }];
    const { container } = render(<PlanLedger plan={plan([objective("O1"), objective("O2", { state: "blocked" })])} stoppers={stoppers} />);
    const rows = [...container.querySelectorAll(".pl__row")];
    // on the second row, not in a separate strip the reader has to match ids against
    expect(rows[0].querySelector(".pl__why")).toBeNull();
    expect(rows[1].querySelector(".pl__why").textContent).toContain("only the walk can fake");
  });

  it("names the objective a row waits on, as a word on the row — not a link that throws you somewhere", () => {
    const { container } = render(
      <PlanLedger
        plan={plan([objective("O2")])}
        stoppers={[{ id: "O2", title: "", kind: "waiting", text: "waits on O1", to: "O1" }]}
      />,
    );
    expect(screen.getByText("O1").tagName).toBe("SPAN");
    expect(container.querySelector(".pl__why button")).toBeNull();
  });

  it("ONE CONTROL FOR RUNNING SPECS, wherever it appears — the header's is the same object as a row's", () => {
    const onRun = jest.fn();
    const o = objective("O1", { plans: [{ id: "RFC-1", project: "p", path: "r.md", specRows: [spec("r.md#L1")] }] });
    const { container } = render(<PlanLedger plan={plan([o], { totals: { specs: 4 } })} onRun={onRun} />);
    const all = [...container.querySelectorAll(".pl__play")];
    expect(all).toHaveLength(2); // the arc's, and the objective's — same class, same shape
    fireEvent.click(all[0]);
    expect(onRun).toHaveBeenCalledWith({ kind: "arc", id: "ARC-9" });
  });

  it("A PLAY BUTTON, NOT A ROW OF DOTS — fifteen specs would have drawn fifteen dots and said nothing a number does not", () => {
    const onRun = jest.fn();
    const o = objective("O3", {
      plans: [{ id: "RFC-1", project: "p", path: "r.md", specRows: [spec("r.md#L1"), spec("r.md#L9"), spec("r.md#L20")] }],
    });
    const { container } = render(<PlanLedger plan={plan([o])} onRun={onRun} />);
    // ONE dot, as the icon beside the count — never one per spec
    expect(container.querySelectorAll(".pl__row > .pl__n .pl__dot")).toHaveLength(1);
    expect(container.querySelector(".pl__row > .pl__n:last-of-type").textContent).toBe("3");
    fireEvent.click(container.querySelector(".pl__row .pl__play"));
    // AN OBJECTIVE'S ADDRESS IS ARC-QUALIFIED. `O3` alone matches nothing — plans point at it as
    // `arc=ARC-9-O3` — so a press scoped to the bare id collected an empty list and ran nothing.
    expect(onRun).toHaveBeenCalledWith({ kind: "objective", id: "ARC-9-O3" });
  });

  it("OFFERS A CLEAR once something has run, and never before — a control that does nothing teaches you to stop reading it", () => {
    const onClear = jest.fn();
    const o = objective("O1", { plans: [{ id: "RFC-1", project: "p", path: "r.md", specRows: [spec("r.md#L1")] }] });
    const { container, rerender } = render(<PlanLedger plan={plan([o])} onClear={onClear} />);
    expect(container.querySelector(".pl__clear")).toBeNull();

    rerender(<PlanLedger plan={plan([o])} marks={{ "r.md#L1": "pass" }} onClear={onClear} />);
    fireEvent.click(container.querySelector(".pl__clear"));
    expect(onClear).toHaveBeenCalled();
  });

  it("it wears how they last came out — one failure and the control reads red", () => {
    const o = objective("O1", { plans: [{ id: "RFC-1", project: "p", path: "r.md", specRows: [spec("r.md#L1"), spec("r.md#L9")] }] });
    const { container } = render(<PlanLedger plan={plan([o])} marks={{ "r.md#L1": "pass", "r.md#L9": "fail" }} />);
    expect(container.querySelector(".pl__row .pl__play").className).toContain("is-fail");
    // the dot fills the same way — both say it, neither is the only place it is said
    expect(container.querySelector(".pl__row .pl__dot").className).toContain("is-fail");
  });

  it("offers no run at all when there is no spec to run — a button that can do nothing is a lie", () => {
    const { container } = render(<PlanLedger plan={plan([objective("O1")], { totals: { specs: 0 } })} />);
    expect(container.querySelector(".pl__run")).toBeNull();
  });

  it("an objective with every claim met but nobody having pressed done reads READY, not open", () => {
    const { container } = render(
      <PlanLedger plan={plan([objective("O1", { ready: true, claims: { met: 2, total: 2 } })])} />,
    );
    expect(container.querySelector(".pl__row").className).toContain("is-ready");
    expect(container.querySelector(".pl__state").textContent).toBe("ready");
  });



  it("A ROW IS CLOSED UNTIL YOU OPEN IT, and opening shows the plans — seven objectives' worth of cards at once is a wall", () => {
    const o = objective("O7", { plans: [{ id: "RFC-1", project: "p", path: "r.md", specRows: [spec("r.md#L10")] }] });
    const { container } = render(<PlanLedger plan={plan([o])} />);
    expect(container.querySelector(".pl__plan")).toBeNull();
    fireEvent.click(container.querySelector(".pl__title"));
    expect(container.querySelector(".pl__plan")).not.toBeNull();
    fireEvent.click(container.querySelector(".pl__title"));
    expect(container.querySelector(".pl__plan")).toBeNull();
  });

  it("TWO ROWS CAN BE OPEN AT ONCE — comparing two objectives is the reason to open either", () => {
    const withPlan = (id) => objective(id, { plans: [{ id: `RFC-${id}`, project: "p", path: `${id}.md`, specRows: [] }] });
    const { container } = render(<PlanLedger plan={plan([withPlan("O1"), withPlan("O2")])} />);
    const lines = [...container.querySelectorAll(".pl__title")];
    fireEvent.click(lines[0]);
    fireEvent.click(lines[1]);
    expect(container.querySelectorAll(".pl__plan")).toHaveLength(2);
  });

  it("SHOWS THE PLANS SERVING AN OBJECTIVE, each with its own station, claims and specs — two plans is a real shape and summing them hid it", () => {
    const o = objective("O3", {
      claims: { met: 2, total: 4 },
      plans: [
        { id: "RFC-2", station: "approved", met: 2, total: 2, project: "p", path: "a.md", specRows: [spec("a.md#L1")] },
        { id: "RFC-3", station: "draft", met: 0, total: 2, project: "p", path: "b.md", specRows: [spec("b.md#L1"), spec("b.md#L9")] },
      ],
    });
    const { container } = render(<PlanLedger plan={plan([o])} />);
    fireEvent.click(container.querySelector(".pl__title"));
    expect([...container.querySelectorAll(".pl__plan-id")].map((e) => e.textContent)).toEqual(["RFC-2", "RFC-3"]);
    expect([...container.querySelectorAll(".pl__plan .pl__station")].map((e) => e.textContent)).toEqual(["approved", "draft"]);
    // each plan's own count, never only the objective's roll-up
    // each plan's OWN counts — claims then specs — never the objective's roll-up
    expect([...container.querySelectorAll(".pl__plan .pl__n")].map((e) => e.textContent)).toEqual(["c2/2", "1", "c0/2", "2"]);
    // and each plan's specs sit under THAT plan, so a dot says where it came from
    expect(container.querySelectorAll(".pl__plan")[1].querySelector(".pl__n:last-of-type").textContent).toBe("2");
  });

  it("a plan row opens its own document — a different document is the one place going somewhere is the point", () => {
    const onOpen = jest.fn();
    const o = objective("O1", { plans: [{ id: "RFC-2", project: "p", path: "a.md", specRows: [] }] });
    const { container } = render(<PlanLedger plan={plan([o])} onOpen={onOpen} />);
    fireEvent.click(container.querySelector(".pl__title"));
    fireEvent.click(screen.getByText("RFC-2"));
    expect(onOpen).toHaveBeenCalledWith({ project: "p", path: "a.md" });
  });

  it("a plan row carries its own NAME, so the card saves the trip it exists to save", () => {
    const o = objective("O1", { plans: [{ id: "RFC-2", title: "every document walks a lifecycle", project: "p", path: "a.md", specRows: [] }] });
    const { container } = render(<PlanLedger plan={plan([o])} />);
    fireEvent.click(container.querySelector(".pl__title"));
    expect(screen.getByText("every document walks a lifecycle")).toBeInTheDocument();
  });

  it("a plan that has agreed NO claims reads quiet, never as a score it did not get", () => {
    const o = objective("O1", { plans: [{ id: "RFC-2", met: 0, total: 0, project: "p", path: "a.md", specRows: [] }] });
    const { container } = render(<PlanLedger plan={plan([o])} />);
    fireEvent.click(container.querySelector(".pl__title"));
    expect(container.querySelector(".pl__plan .pl__n").className).toContain("is-none");
  });

  it("a plan row wears the worst thing under it — a failing spec is a fact about THAT document", () => {
    const o = objective("O1", {
      plans: [
        { id: "RFC-2", project: "p", path: "a.md", specRows: [spec("a.md#L1")] },
        { id: "RFC-3", project: "p", path: "b.md", specRows: [spec("b.md#L1")] },
      ],
    });
    const { container } = render(<PlanLedger plan={plan([o])} marks={{ "a.md#L1": "pass", "b.md#L1": "fail" }} />);
    fireEvent.click(container.querySelector(".pl__title"));
    const cards = [...container.querySelectorAll(".pl__plan")];
    expect(cards[0].className).not.toContain("has-fail");
    expect(cards[1].className).toContain("has-fail");
  });

  it("each plan row runs its OWN document", () => {
    const onRun = jest.fn();
    const o = objective("O1", { plans: [{ id: "RFC-3", project: "p", path: "b.md", specRows: [spec("b.md#L1")] }] });
    const { container } = render(<PlanLedger plan={plan([o])} onRun={onRun} />);
    fireEvent.click(container.querySelector(".pl__title"));
    fireEvent.click(container.querySelector(".pl__plan .pl__play"));
    expect(onRun).toHaveBeenCalledWith({ kind: "document", id: "RFC-3" });
  });

  it("THE STATE IS A WORD, not a symbol — a shape has to be learned and nothing here teaches it", () => {
    const { container } = render(<PlanLedger plan={plan([objective("O4", { state: "doing" })])} />);
    const st = container.querySelector(".pl__state");
    expect(st.tagName).toBe("SPAN"); // an objective is not ticked off; nothing presses it
    expect(st.textContent).toBe("in progress");
  });

  it("EVERY COUNT SAYS WHAT IT COUNTS — a bare 2/6 beside a bare 1/2 names nothing", () => {
    const o = objective("O3", {
      claims: { met: 2, total: 6 },
      plans: [
        { id: "RFC-2", project: "p", path: "a.md", specRows: [spec("a.md#L1")] },
        { id: "RFC-3", project: "p", path: "b.md", specRows: [spec("b.md#L1"), spec("b.md#L9")] },
      ],
    });
    const { container } = render(<PlanLedger plan={plan([o])} />);
    // THREE COUNTS, EACH WEARING ITS KIND AS A MARK — a word in front of each tripled the width
    // of a row built to be scanned, and a bare fraction named nothing.
    const counts = [...container.querySelectorAll(".pl__row > .pl__n")];
    expect(counts.map((e) => e.textContent)).toEqual(["2", "c2/6", "3"]);
    expect(counts[0].querySelector(".pl__doc")).not.toBeNull(); // a plan is a document
    expect(counts[1].querySelector(".pl__kind").textContent).toBe("c"); // claim ids are c1, c2
  });

  it("a count of nothing reads QUIET — zero is the honest number and it must not shout", () => {
    const { container } = render(<PlanLedger plan={plan([objective("O1")])} />);
    const counts = [...container.querySelectorAll(".pl__row > .pl__n")];
    expect(counts.map((e) => e.textContent)).toEqual(["0", "c0", "0"]);
    expect(counts.every((e) => e.className.includes("is-none"))).toBe(true);
    expect(container.querySelector(".pl__row .pl__play")).toBeNull(); // nothing to run, no control
  });

  it("the ARC wears its own station beside its id — the percent was on screen and the word was not", () => {
    const { container } = render(<PlanLedger plan={plan([objective("O1")])} />);
    const st = container.querySelector(".pl__headline .pl__station");
    expect(st.textContent).toBe("approved");
  });

});
