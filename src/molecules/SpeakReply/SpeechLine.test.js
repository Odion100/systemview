import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SpeechLine from "./SpeechLine";
import { cutIn, enqueue, setPaused, view } from "./speechQueue";

const row = (key) => ({ key, label: key, start: () => ({ stop: () => {} }) });

afterEach(() => cutIn(null));

describe("the line draws when there is a line", () => {
  // AND NOT BEFORE. Showing forward over an empty queue was the wrong fix for *"I want to move
  // forward"* — his correction: *"it's nice when you have a forward button, but there's nothing to
  // move forward to… the problem was, there's no new queue."* Filling the queue is the fix;
  // drawing a control that leads nowhere is not.
  it("draws nothing while one reply reads alone — forward would have nowhere to go", () => {
    cutIn(row("r1"));
    const { container } = render(<SpeechLine />);
    expect(view().waiting).toEqual([]);
    expect(container.querySelector(".speech-line")).toBeNull();
  });

  it("appears with forward and stop the moment something is behind it", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    render(<SpeechLine />);
    expect(screen.getByTitle("Skip to the next one")).toBeInTheDocument();
    expect(screen.getByTitle("Stop reading and empty the line")).toBeInTheDocument();
  });

  it("is gone entirely when nothing is talking and nothing waits", () => {
    cutIn(null);
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line")).toBeNull();
  });

  // A pause is the exception: it holds the line forever, so silence with no explanation is the
  // state he once got stuck in.
  it("still draws while paused, because a pause needs to say so", () => {
    cutIn(row("r1"));
    setPaused("r1", true);
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line")).not.toBeNull();
    setPaused("r1", false);
  });
});

describe("the one being read is on the line", () => {
  it("lists the reply that is talking, not only the ones waiting", () => {
    cutIn(row("the-one-talking"));
    enqueue(row("next-up"));
    render(<SpeechLine />);
    expect(screen.getByText("the-one-talking")).toBeInTheDocument();
    expect(screen.getByText("next-up")).toBeInTheDocument();
  });

  it("counts it, so one reading plus one waiting reads as two in line", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    render(<SpeechLine />);
    expect(screen.getByTitle("Stop reading and empty the line").textContent).toContain("2 in line");
  });

  it("marks it as the one reading, so it is not mistaken for a waiting row", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    const { container } = render(<SpeechLine />);
    expect(container.querySelectorAll(".speech-line__row--reading")).toHaveLength(1);
  });

  it("puts it first, ahead of everything waiting", () => {
    cutIn(row("playing-now"));
    enqueue(row("waiting-one"));
    const { container } = render(<SpeechLine />);
    const rows = [...container.querySelectorAll(".speech-line__row")].map((r) => r.textContent);
    expect(rows[0]).toContain("playing-now");
    expect(rows[1]).toContain("waiting-one");
    expect(screen.getByTitle("Stop reading and empty the line").textContent).toContain("2 in line");
  });

  // SUPERSEDED — this used to assert the reading row had NO remove. His ruling: *"there are ×
  // buttons all, to the end."* Every row in the line answers to ×, and on the one talking it means
  // done with this, move on.
  it("gives every row an x, to the end of the line — the one reading included", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    enqueue(row("r3"));
    const { container } = render(<SpeechLine />);
    const rows = [...container.querySelectorAll(".speech-line__row")];
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.querySelector(".speech-line__drop"))).toBe(true);
  });

  it("moves on rather than stopping when the reading row's x is pressed", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    const { container } = render(<SpeechLine />);
    const x = container.querySelector(".speech-line__row--reading .speech-line__drop");
    fireEvent.click(x);
    expect(view().playing.key).toBe("r2");
  });
});

// THE LINE IS A WAY BACK TO THE REPLY. *"It was all the way up and it was playing, maybe I want to
// go right to it."* Nothing else on screen knows which reply is talking, so nothing else could
// offer this.
describe("clicking a row goes to that reply", () => {
  it("hands back the key of the row that is reading", () => {
    const went = [];
    cutIn(row("up-at-the-top"));
    enqueue(row("r2"));
    render(<SpeechLine onGo={(k) => went.push(k)} />);
    fireEvent.click(screen.getByText("up-at-the-top"));
    expect(went).toEqual(["up-at-the-top"]);
  });

  it("and of a row that is only waiting", () => {
    const went = [];
    cutIn(row("r1"));
    enqueue(row("later-one"));
    render(<SpeechLine onGo={(k) => went.push(k)} />);
    fireEvent.click(screen.getByText("later-one"));
    expect(went).toEqual(["later-one"]);
  });

  it("does not offer the door when nothing can open it", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    const { container } = render(<SpeechLine />);
    const doors = [...container.querySelectorAll(".speech-line__text--go")];
    expect(doors.length).toBe(2);
    expect(doors.every((d) => d.disabled)).toBe(true);
  });

  it("going to a row does not remove it from the line", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    render(<SpeechLine onGo={() => {}} />);
    fireEvent.click(screen.getByText("r2"));
    expect(view().waiting.map((w) => w.key)).toEqual(["r2"]);
  });
});
