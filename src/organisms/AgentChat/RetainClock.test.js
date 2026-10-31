import React from "react";
import { render, screen, act } from "@testing-library/react";
import RetainClock from "./RetainClock";

const S = 1000, M = 60000, H = 3600000, D = 86400000;

// THE DRAWER'S NUMBER HAS TO MOVE. It read the right words off the same rule the document reads and
// then froze, because the band's render is not re-triggered by time passing — *"I want to see it
// counting down to incentivize."* These specs hold the beat, and hold the four cases that must NOT
// arm one: an interval in the drawer per report is a cost, and a clock with nothing to count is
// pure cost.
describe("the drawer's retention clock", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const at = (ms) => jest.setSystemTime(new Date(ms));
  const t0 = 1_700_000_000_000;

  it("counts down on its own — no outside re-render, and the words change", () => {
    at(t0);
    render(<RetainClock state={{ retain: "4h" }} openedAt={t0 - (3 * H + 30 * M)} />);
    expect(screen.getByText("retires in 30m")).toBeInTheDocument();
    // a minute of real time, nobody touching the drawer (advancing the timers moves the fake
    // clock with them, which is the point — the face reads `Date.now()` and nothing else)
    act(() => {
      jest.advanceTimersByTime(60 * S);
    });
    expect(screen.getByText("retires in 29m")).toBeInTheDocument();
  });

  it("ticks at the granularity of its own words — a fortnight does not redraw every second", () => {
    at(t0);
    render(<RetainClock state={{ retain: "14d" }} openedAt={t0 - 11 * D} />);
    expect(screen.getByText("retires in 3 days")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(10 * S);
    });
    // ten seconds later the face has not been redrawn at all, and says the same true thing
    expect(screen.getByText("retires in 3 days")).toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(1); // one interval for this row, never a second clock
  });

  it("arms no interval when there is nothing left to count", () => {
    at(t0);
    const { unmount: a } = render(<RetainClock state={{ retain: "permanent" }} openedAt={t0} />);
    expect(jest.getTimerCount()).toBe(0);
    a();
    const { unmount: b } = render(<RetainClock state={{ retain: "4h", retired: "2026-10-30" }} openedAt={t0} />);
    expect(jest.getTimerCount()).toBe(0);
    b();
    const { unmount: c } = render(<RetainClock state={{ retain: "" }} openedAt={t0} />);
    expect(jest.getTimerCount()).toBe(0);
    c();
    // unread — the window measures his attention, so this clock has not started
    render(<RetainClock state={{ retain: "4h" }} openedAt={null} />);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("says nothing on a row whose leaf declared nothing, and nothing once retired", () => {
    at(t0);
    const { container: inv } = render(<RetainClock state={{ invalid: "no retention" }} openedAt={t0} />);
    expect(inv).toBeEmptyDOMElement();
    const { container: ret } = render(
      <RetainClock state={{ retain: "4h", retired: "2026-10-30" }} openedAt={t0 - 5 * H} />,
    );
    expect(ret).toBeEmptyDOMElement();
    const { container: perm } = render(<RetainClock state={{ retain: "permanent" }} openedAt={t0} />);
    expect(perm).toBeEmptyDOMElement();
  });

  it("wears the urgency the row is meant to feel, and stops counting when it runs out", () => {
    at(t0);
    const { container } = render(<RetainClock state={{ retain: "4h" }} openedAt={t0 - 3 * H} />);
    expect(container.querySelector(".md-report__clock.is-soon")).not.toBeNull();
    const { container: out } = render(<RetainClock state={{ retain: "4h" }} openedAt={t0 - 5 * H} />);
    expect(out.textContent).toMatch(/clock ran out/);
  });

  it("an unread report says what it will do, without a clock", () => {
    at(t0);
    render(<RetainClock state={{ retain: "14d" }} openedAt={null} />);
    expect(screen.getByText("retires 14 days after first read")).toBeInTheDocument();
  });
});
