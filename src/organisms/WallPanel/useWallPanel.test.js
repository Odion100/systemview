// THE PANEL ENGINE'S CLAIMS — extracted precisely because a third hand-copy shipped glitchy (the
// blink: collapsing in-flow moved the container mid-drag). Nothing renders the pages that mount
// this in any suite, so the ENGINE carries its own proof: resize, clamp, collapse-past-the-edge,
// the gesture becoming a pull, the pull's open-at-the-line rule, persistence, and the chat guard.
import React, { useRef } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import useWallPanel from "./useWallPanel";

const RECT = { left: 0, right: 1000, width: 1000, top: 0, bottom: 500, height: 500 };

function Harness({ side = "right", name = "t" }) {
  const rowRef = useRef(null);
  const p = useWallPanel({ name, side, rowRef, defaultW: 40, min: 20, max: 60, collapseAt: 10, pullGuard: (e) => !!(e.target.closest && e.target.closest(".agent-chat")) });
  return (
    <div
      ref={(el) => {
        if (el) el.getBoundingClientRect = () => RECT;
        rowRef.current = el;
      }}
    >
      <div data-testid="divider" onMouseDown={p.startDrag} />
      <div data-testid="pull" onMouseDown={p.startPull} />
      <div data-testid="state">{`${p.open ? "open" : "closed"}:${p.w}`}</div>
      <div className="agent-chat">
        <button data-testid="chat-press" onMouseDown={p.startPull} />
      </div>
    </div>
  );
}

const state = (r) => r.getByTestId("state").textContent;
const moveTo = (clientX) => act(() => { fireEvent.mouseMove(window, { clientX }); });
const release = () => act(() => { fireEvent.mouseUp(window); });

let keys = 0;
const fresh = () => `t${++keys}`;

afterEach(() => release());

it("drags to resize from the right side, clamped both ways, and persists the width", () => {
  const name = fresh();
  const r = render(<Harness name={name} />);
  fireEvent.mouseDown(r.getByTestId("divider"));
  moveTo(700); // raw = (1000-700)/1000 = 30%
  expect(state(r)).toBe("open:30");
  moveTo(100); // raw 90 → clamped to max 60
  expect(state(r)).toBe("open:60");
  release();
  expect(localStorage.getItem(`sv.${name}W`)).toBe("60");
  // Nothing moves once the mouse is up.
  moveTo(500);
  expect(state(r)).toBe("open:60");
});

it("a left-side panel measures from the left edge", () => {
  const r = render(<Harness name={fresh()} side="left" />);
  fireEvent.mouseDown(r.getByTestId("divider"));
  moveTo(300); // raw = 300/1000 = 30%
  expect(state(r)).toBe("open:30");
});

it("a BOTTOM band measures height from the bottom edge — the chat strip's axis", () => {
  const r = render(<Harness name={fresh()} side="bottom" />);
  fireEvent.mouseDown(r.getByTestId("divider"));
  act(() => { fireEvent.mouseMove(window, { clientY: 350 }); }); // raw = (500-350)/500 = 30%
  expect(state(r)).toBe("open:30");
  act(() => { fireEvent.mouseMove(window, { clientY: 490 }); }); // raw 2 < collapseAt 10 → the label state
  expect(state(r)).toMatch(/^closed/);
});

it("dragging past the edge collapses — and the SAME gesture pulls it back out", () => {
  const name = fresh();
  const r = render(<Harness name={name} />);
  fireEvent.mouseDown(r.getByTestId("divider"));
  moveTo(950); // raw 5 < collapseAt 10 → closed
  expect(state(r)).toMatch(/^closed/);
  expect(localStorage.getItem(`sv.${name}Open`)).toBe("false");
  // Still holding: back out past the panel's own minimum and it is open and resizing again.
  moveTo(960); // raw 4 — inside the dead zone, stays closed (no blink)
  expect(state(r)).toMatch(/^closed/);
  moveTo(700); // raw 30 ≥ min 20 → open, already resizing
  expect(state(r)).toBe("open:30");
});

it("a pull opens at the collapse line + hysteresis, popping in at the panel's minimum", () => {
  const r = render(<Harness name={fresh()} />);
  fireEvent.mouseDown(r.getByTestId("divider"));
  moveTo(950); // collapse it
  release();
  fireEvent.mouseDown(r.getByTestId("pull"));
  moveTo(890); // raw 11 < collapseAt 10 + 3 — still closed (the hysteresis hair)
  expect(state(r)).toMatch(/^closed/);
  moveTo(860); // raw 14 clears the line → OPEN, width floored at min 20 (no dead stretch to 20)
  expect(state(r)).toBe("open:20");
  moveTo(750); // and from the minimum it tracks the pointer — raw 25
  expect(state(r)).toBe("open:25");
});

it("a guarded panel ignores pulls starting inside the chat (opt-in per panel)", () => {
  const r = render(<Harness name={fresh()} />);
  fireEvent.mouseDown(r.getByTestId("divider"));
  moveTo(950);
  release();
  fireEvent.mouseDown(r.getByTestId("chat-press"));
  moveTo(700);
  expect(state(r)).toMatch(/^closed/);
});

it("the light arrives with MOVEMENT, on the held line only — a plain press stays clean (a click must stay a click)", () => {
  const r = render(<Harness name={fresh()} />);
  const divider = r.getByTestId("divider");
  const other = r.getByTestId("pull");
  fireEvent.mouseDown(divider);
  // Pressed, not moved: nothing lights and the shield is down — this is what keeps click-to-open alive.
  expect(divider.classList.contains("panel-divider--live")).toBe(false);
  expect(document.body.classList.contains("panel-resizing")).toBe(false);
  moveTo(700);
  expect(divider.classList.contains("panel-divider--live")).toBe(true);
  expect(other.classList.contains("panel-divider--live")).toBe(false);
  expect(document.body.classList.contains("panel-resizing")).toBe(true);
  release();
  expect(divider.classList.contains("panel-divider--live")).toBe(false);
  expect(document.body.classList.contains("panel-resizing")).toBe(false);
});

it("a click-open from a dragged-closed sliver snaps to the default — never reopens tiny", () => {
  const name = fresh();
  localStorage.setItem(`sv.${name}W`, "20"); // the pass-through height a collapse drag leaves (= min)
  localStorage.setItem(`sv.${name}Open`, "false");
  function Opener() {
    const rowRef = useRef(null);
    const p = useWallPanel({ name, side: "right", rowRef, defaultW: 40, min: 20, max: 60, collapseAt: 10 });
    return <button data-testid="open" onClick={() => p.setOpen(true)}>{`${p.open ? "open" : "closed"}:${p.w}`}</button>;
  }
  const r = render(<Opener />);
  fireEvent.click(r.getByTestId("open"));
  expect(r.getByTestId("open").textContent).toBe("open:40");
});

it("width and openness come back from storage", () => {
  const name = fresh();
  localStorage.setItem(`sv.${name}W`, "33");
  localStorage.setItem(`sv.${name}Open`, "false");
  const r = render(<Harness name={name} />);
  expect(state(r)).toBe("closed:33");
});
