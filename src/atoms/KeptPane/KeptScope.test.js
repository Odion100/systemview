// A HIDDEN PANEL HOLDS THE ADDRESS IT WAS LAST SHOWN WITH.
//
// The claim that matters is not "it renders the right string" — it is that the children's props
// STOP CHANGING while the panel is away, because that is what keeps their effects from re-firing.
// So these assertions count effect runs, not renders.
import React, { useEffect } from "react";
import { render } from "@testing-library/react";
import KeptScope from "./KeptScope";

// A stand-in for a document panel: one effect keyed on the scope it was handed, exactly like the
// listing effects in the real ones.
const Panel = ({ scope, onEffect }) => {
  useEffect(() => {
    onEffect(scope.serviceId);
  }, [scope.projectCode, scope.serviceId, onEffect]);
  return <div data-testid="panel">{scope.serviceId}</div>;
};

const mount = (showing, scope, onEffect) =>
  render(
    <KeptScope showing={showing} scope={scope}>
      {(s) => <Panel scope={s} onEffect={onEffect} />}
    </KeptScope>
  );

describe("KeptScope", () => {
  it("passes the live scope straight through while the panel is showing", () => {
    const onEffect = jest.fn();
    const { rerender, getByTestId } = mount(true, { projectCode: "p", serviceId: "A" }, onEffect);
    expect(getByTestId("panel").textContent).toBe("A");
    rerender(
      <KeptScope showing scope={{ projectCode: "p", serviceId: "B" }}>
        {(s) => <Panel scope={s} onEffect={onEffect} />}
      </KeptScope>
    );
    expect(getByTestId("panel").textContent).toBe("B");
    expect(onEffect.mock.calls.map((c) => c[0])).toEqual(["A", "B"]);
  });

  // THE WHOLE POINT. Walking the service tree re-fired every hidden document's effects; here the
  // scope moves three times behind the panel's back and its effect runs exactly once.
  it("a hidden panel keeps the last scope it was SHOWN with, so its effects do not re-fire", () => {
    const onEffect = jest.fn();
    const { rerender, getByTestId } = mount(true, { projectCode: "p", serviceId: "A" }, onEffect);
    for (const svc of ["B", "C", "D"]) {
      rerender(
        <KeptScope showing={false} scope={{ projectCode: "p", serviceId: svc }}>
          {(s) => <Panel scope={s} onEffect={onEffect} />}
        </KeptScope>
      );
    }
    expect(getByTestId("panel").textContent).toBe("A");
    expect(onEffect).toHaveBeenCalledTimes(1);
  });

  it("coming back adopts whatever the scope is NOW — it holds an address, it does not freeze one", () => {
    const onEffect = jest.fn();
    const { rerender, getByTestId } = mount(true, { projectCode: "p", serviceId: "A" }, onEffect);
    rerender(
      <KeptScope showing={false} scope={{ projectCode: "p", serviceId: "B" }}>
        {(s) => <Panel scope={s} onEffect={onEffect} />}
      </KeptScope>
    );
    rerender(
      <KeptScope showing scope={{ projectCode: "p", serviceId: "C" }}>
        {(s) => <Panel scope={s} onEffect={onEffect} />}
      </KeptScope>
    );
    expect(getByTestId("panel").textContent).toBe("C");
    expect(onEffect.mock.calls.map((c) => c[0])).toEqual(["A", "C"]);
  });

  it("a panel mounted already hidden still has an address — the one it was born with", () => {
    const onEffect = jest.fn();
    const { getByTestId } = mount(false, { projectCode: "p", serviceId: "Z" }, onEffect);
    expect(getByTestId("panel").textContent).toBe("Z");
  });

  // NO ELEMENT. The centre's height arrives through a direct-child chain, so anything that wraps a
  // panel breaks the layout — which is why this is a render prop and not a <div>, and why that is
  // worth an assertion rather than a comment.
  it("generates no DOM node of its own", () => {
    const { container } = render(
      <KeptScope showing scope={{ projectCode: "p" }}>
        {() => <div className="only-child" />}
      </KeptScope>
    );
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild.className).toBe("only-child");
  });
});
