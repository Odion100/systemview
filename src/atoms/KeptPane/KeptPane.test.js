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
