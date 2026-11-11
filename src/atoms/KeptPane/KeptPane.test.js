import React from "react";
import { render, screen } from "@testing-library/react";
import KeptPane from "./KeptPane";

const m = (params) => ({ params });

describe("KeptPane — a pane that is not showing is still alive", () => {
  it("renders its children when the route matches", () => {
    render(<KeptPane match={m({ projectCode: "sv" })}>{(p) => <i>{p.projectCode}</i>}</KeptPane>);
    expect(screen.getByText("sv")).toBeInTheDocument();
  });

  it("stays out of the DOM until its first visit — there is nothing to keep yet", () => {
    const { container } = render(<KeptPane match={null}>{() => <i>never</i>}</KeptPane>);
    expect(container.firstChild).toBeNull();
  });

  it("HIDES rather than unmounting once it has been visited — the whole point", () => {
    const { container, rerender } = render(
      <KeptPane match={m({ projectCode: "sv" })}>{(p) => <i>{p.projectCode}</i>}</KeptPane>,
    );
    rerender(<KeptPane match={null}>{(p) => <i>{p.projectCode}</i>}</KeptPane>);
    // still mounted, still carrying its address — just away
    expect(screen.getByText("sv")).toBeInTheDocument();
    expect(container.querySelector(".kept-pane--away")).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("KEEPS its last address while away — asked for params, a hidden pane would blank its project", () => {
    const { rerender } = render(
      <KeptPane match={m({ projectCode: "systemview-test", methodName: "add" })}>
        {(p) => <i>{`${p.projectCode}/${p.methodName || "-"}`}</i>}
      </KeptPane>,
    );
    rerender(<KeptPane match={null}>{(p) => <i>{`${p.projectCode}/${p.methodName || "-"}`}</i>}</KeptPane>);
    expect(screen.getByText("systemview-test/add")).toBeInTheDocument();
  });

  it("takes a new address when it comes back, rather than keeping the stale one", () => {
    const { rerender } = render(
      <KeptPane match={m({ projectCode: "a" })}>{(p) => <i>{p.projectCode}</i>}</KeptPane>,
    );
    rerender(<KeptPane match={null}>{(p) => <i>{p.projectCode}</i>}</KeptPane>);
    rerender(<KeptPane match={m({ projectCode: "b" })}>{(p) => <i>{p.projectCode}</i>}</KeptPane>);
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("the child is rendered ONCE across a leave and a return — it is the same instance, not a rebuild", () => {
    const mounts = jest.fn();
    const Probe = () => {
      React.useEffect(() => mounts(), []);
      return <i>probe</i>;
    };
    const { rerender } = render(<KeptPane match={m({})}>{() => <Probe />}</KeptPane>);
    rerender(<KeptPane match={null}>{() => <Probe />}</KeptPane>);
    rerender(<KeptPane match={m({})}>{() => <Probe />}</KeptPane>);
    // An unmount-and-rebuild would have run the effect three times. This is the claim the whole
    // component exists for: the terminals and the chat inside a page survive being left.
    expect(mounts).toHaveBeenCalledTimes(1);
  });

  it("accepts plain children too, for a pane with no address to carry", () => {
    render(
      <KeptPane match={m({})}>
        <i>plain</i>
      </KeptPane>,
    );
    expect(screen.getByText("plain")).toBeInTheDocument();
  });
});

// ─── THE TAB FORM: `show` + `keep`, for a surface with no route ────────────────────────────────
//
// His ask, 2026-11-10: *"how can we make a document keep state as you go across tabs without...
// coming to the page."* The centre's panels are not routes — they are a `tab` string compared
// against the URL — so the route form does not reach them. Same mechanism, second way in, ONE
// component: a tab-flavoured copy of this file would get the keep-the-address part wrong first,
// which is the whole reason it is not a copy.
describe("the tab form", () => {
  it("renders when shown, and hides rather than unmounting once it has been shown", () => {
    const { container, rerender } = render(
      <KeptPane show keep={{ ns: "Math.add" }}>{(a) => <b>{a.ns}</b>}</KeptPane>,
    );
    expect(container.querySelector("b").textContent).toBe("Math.add");
    expect(container.querySelector(".kept-pane--away")).toBeNull();

    rerender(<KeptPane show={false} keep={undefined}>{(a) => <b>{a.ns}</b>}</KeptPane>);
    // still in the DOM, and still carrying its address — the pane survived being left
    expect(container.querySelector("b").textContent).toBe("Math.add");
    expect(container.querySelector(".kept-pane--away")).not.toBeNull();
    expect(container.querySelector(".kept-pane").getAttribute("aria-hidden")).toBe("true");
  });

  it("stays out of the DOM until its first showing — a tab nobody opened costs nothing", () => {
    const { container } = render(<KeptPane show={false}><b>x</b></KeptPane>);
    expect(container.querySelector(".kept-pane")).toBeNull();
  });

  // THE ONE THAT MATTERS, and the reason this is not just `display: none` at the call site.
  it("the child is mounted ONCE across a leave and a return — not rebuilt", () => {
    let mounts = 0;
    const Counted = () => {
      React.useEffect(() => { mounts += 1; }, []);
      return <b>child</b>;
    };
    const { rerender } = render(<KeptPane show keep={{}}><Counted /></KeptPane>);
    expect(mounts).toBe(1);
    rerender(<KeptPane show={false}><Counted /></KeptPane>);
    rerender(<KeptPane show keep={{}}><Counted /></KeptPane>);
    expect(mounts).toBe(1, "a remount here would be the bug this component exists to prevent");
  });

  it("a pane with nothing to carry still records that it has been shown", () => {
    const { container, rerender } = render(<KeptPane show><b>no address</b></KeptPane>);
    rerender(<KeptPane show={false}><b>no address</b></KeptPane>);
    expect(container.querySelector("b")).not.toBeNull();
    expect(container.querySelector(".kept-pane--away")).not.toBeNull();
  });

  it("takes a new address when it comes back, and `show` and `match` do not interfere", () => {
    const { container, rerender } = render(<KeptPane show keep={{ ns: "a" }}>{(x) => <b>{x.ns}</b>}</KeptPane>);
    rerender(<KeptPane show={false}>{(x) => <b>{x.ns}</b>}</KeptPane>);
    rerender(<KeptPane show keep={{ ns: "b" }}>{(x) => <b>{x.ns}</b>}</KeptPane>);
    expect(container.querySelector("b").textContent).toBe("b");
  });

  // PASSING `match` STILL WINS, so every existing caller is untouched by the new door.
  it("the route form is unchanged — `match` present decides, even with `show` absent", () => {
    const { container, rerender } = render(
      <KeptPane match={{ params: { projectCode: "p" } }}>{(a) => <b>{a.projectCode}</b>}</KeptPane>,
    );
    expect(container.querySelector("b").textContent).toBe("p");
    rerender(<KeptPane match={null}>{(a) => <b>{a.projectCode}</b>}</KeptPane>);
    expect(container.querySelector(".kept-pane--away")).not.toBeNull();
    expect(container.querySelector("b").textContent).toBe("p");
  });
});

// THE WRAPPER ADDS NO BOX, and that is load-bearing rather than tidy.
//
// `.kept-pane` is `display: contents` so the page's layout is exactly what it was before this
// component existed. The trap that follows from it, and which I walked into while wiring the
// centre's panels: a LAYOUT class handed to `className` lands on an element that generates no box,
// so it silently does nothing. The box has to stay INSIDE as a child.
it("is layout-neutral while showing — the class it carries is its own, never a layout box", () => {
  const { container } = render(
    <KeptPane show keep={{}} className="mine">
      <div className="the-real-box"><b>x</b></div>
    </KeptPane>,
  );
  const outer = container.querySelector(".kept-pane");
  expect(outer.className).toContain("mine");
  // the child's own box survives untouched — which is what callers must rely on
  expect(outer.querySelector(".the-real-box")).not.toBeNull();
  expect(outer.querySelector(".the-real-box b").textContent).toBe("x");
});
