import React, { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import BoxSelect from "./BoxSelect";

// THE CRASH THIS FILE EXISTS FOR. `boxHit` had ten tests and this component had none, so a state
// shape that disagreed with the render — `setCaught({ rects })` against `caught.at.left` — shipped
// and took the whole app down on the first drag. A pure module's tests say nothing about the
// contract between a component's state and its own JSX.
const rect = (top, bottom, left = 0, right = 200) => ({
  top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top,
});

const Host = ({ onPlay }) => {
  const ref = useRef(null);
  return (
    <div ref={ref} data-testid="scope">
      <div data-row="a">first block</div>
      <div data-row="b">second block</div>
      <BoxSelect scopeRef={ref} onPlay={onPlay} />
    </div>
  );
};

const stubRects = () => {
  // jsdom measures everything as zero, so the geometry has to be supplied or every hit test misses.
  Element.prototype.getBoundingClientRect = function () {
    if (this.dataset && this.dataset.row === "a") return rect(0, 40);
    if (this.dataset && this.dataset.row === "b") return rect(40, 90);
    return rect(0, 300);
  };
};

const drag = (scope, from, to) => {
  fireEvent.mouseDown(scope, { clientX: from.x, clientY: from.y, button: 0 });
  fireEvent.mouseMove(scope, { clientX: to.x, clientY: to.y });
  fireEvent.mouseUp(window, { clientX: to.x, clientY: to.y, button: 0 });
};

describe("dragging a box over the conversation", () => {
  beforeEach(stubRects);

  it("draws what it caught, without throwing", () => {
    const { container } = render(<Host onPlay={() => {}} />);
    drag(screen.getByTestId("scope"), { x: 10, y: 5 }, { x: 120, y: 60 });
    const panel = container.querySelector(".box-select__caught");
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain("first block");
    expect(panel.textContent).toContain("second block");
  });

  it("hands the text to the caller when the play is pressed, and takes itself away", () => {
    const spoken = [];
    const { container } = render(<Host onPlay={(t) => spoken.push(t)} />);
    drag(screen.getByTestId("scope"), { x: 10, y: 5 }, { x: 120, y: 60 });
    fireEvent.click(container.querySelector(".box-select__play"));
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toContain("first block");
    expect(container.querySelector(".box-select__caught")).toBeNull();
  });

  it("a click is not a drag — nothing is caught", () => {
    const { container } = render(<Host onPlay={() => {}} />);
    drag(screen.getByTestId("scope"), { x: 10, y: 5 }, { x: 12, y: 7 });
    expect(container.querySelector(".box-select__caught")).toBeNull();
  });

  it("goes away on a click elsewhere, with nothing to dismiss", () => {
    const { container } = render(<Host onPlay={() => {}} />);
    drag(screen.getByTestId("scope"), { x: 10, y: 5 }, { x: 120, y: 60 });
    expect(container.querySelector(".box-select__caught")).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(container.querySelector(".box-select__caught")).toBeNull();
  });

  it("renders nothing at all until something is dragged", () => {
    const { container } = render(<Host onPlay={() => {}} />);
    expect(container.querySelector(".box-select")).toBeNull();
  });
});

// HIS REPORT: *"if you try to grab the last few lines, the play shows up too low."* The panel was
// anchored below the drag unconditionally, so a selection at the end of the conversation put it past
// the bottom of the list, where it is clipped and the play cannot be reached.
describe("where the panel lands", () => {
  const scopeBox = (sh, ch) => {
    Object.defineProperty(HTMLElement.prototype, "scrollTop", { configurable: true, value: 0 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: ch });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: sh });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(HTMLElement.prototype, "scrollLeft", { configurable: true, value: 0 });
  };

  it("sits BELOW the drag when there is room under it", () => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.dataset && this.dataset.row === "a") return rect(0, 40);
      if (this.dataset && this.dataset.row === "b") return rect(40, 90);
      if (this.className === "box-select__caught") return rect(0, 50, 0, 200);
      return rect(0, 300);
    };
    scopeBox(300, 300);
    const { container } = render(<Host onPlay={() => {}} />);
    drag(screen.getByTestId("scope"), { x: 10, y: 5 }, { x: 120, y: 60 });
    const panel = container.querySelector(".box-select__caught");
    expect(Number.parseInt(panel.style.top, 10)).toBeGreaterThanOrEqual(60);
  });

  it("flips ABOVE the drag when below would hang past the bottom of the list", () => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.dataset && this.dataset.row === "a") return rect(200, 240);
      if (this.dataset && this.dataset.row === "b") return rect(240, 290);
      if (this.className === "box-select__caught") return rect(0, 80, 0, 200);
      return rect(0, 300);
    };
    scopeBox(300, 300); // the drag ends at 290, so below (294 + 80) overflows 300
    const { container } = render(<Host onPlay={() => {}} />);
    drag(screen.getByTestId("scope"), { x: 10, y: 205 }, { x: 120, y: 285 });
    const panel = container.querySelector(".box-select__caught");
    const top = Number.parseInt(panel.style.top, 10);
    expect(top).toBeLessThan(205); // above the drag's own top
    expect(top).toBeGreaterThanOrEqual(0); // and still inside the list
  });

  it("never leaves the panel hanging outside the list in either direction", () => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.dataset && this.dataset.row === "a") return rect(0, 40);
      if (this.dataset && this.dataset.row === "b") return rect(40, 90);
      if (this.className === "box-select__caught") return rect(0, 95, 0, 200); // taller than fits
      return rect(0, 300);
    };
    scopeBox(100, 100);
    const { container } = render(<Host onPlay={() => {}} />);
    drag(screen.getByTestId("scope"), { x: 10, y: 5 }, { x: 120, y: 95 });
    const panel = container.querySelector(".box-select__caught");
    const top = Number.parseInt(panel.style.top, 10);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top + 95).toBeLessThanOrEqual(100 + 2);
  });
});

// TURNING NATIVE SELECTION OFF IS THIS COMPONENT'S JOB, and copy is what compensates for it.
describe("the box owns selection in its scope", () => {
  beforeEach(stubRects);

  it("marks its own scope, and unmarks it when it goes", () => {
    const { unmount, getByTestId } = render(<Host />);
    const scope = getByTestId("scope");
    expect(scope.classList.contains("box-select-scope")).toBe(true);
    unmount();
    expect(scope.classList.contains("box-select-scope")).toBe(false);
  });

  it("shift-drag is a drag like any other now — there is no native selection to defer to", () => {
    const { getByTestId } = render(<Host />);
    const scope = getByTestId("scope");
    fireEvent.mouseDown(scope, { clientX: 5, clientY: 5, button: 0, shiftKey: true });
    fireEvent.mouseMove(scope, { clientX: 150, clientY: 60 });
    fireEvent.mouseUp(window, { clientX: 150, clientY: 60, button: 0 });
    expect(screen.getByLabelText("Read this selection")).toBeInTheDocument();
  });

  it("copy puts what was caught on the clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { getByTestId } = render(<Host />);
    drag(getByTestId("scope"), { x: 5, y: 5 }, { x: 150, y: 60 });
    const copy = screen.getByLabelText("Copy this selection");
    await fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith("first block\n\nsecond block");
  });
});
