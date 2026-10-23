import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SpeechLine from "./SpeechLine";
import { cutIn, enqueue, setPaused, setWarming, view } from "./speechQueue";

const row = (key) => ({ key, label: key, start: () => ({ stop: () => {} }) });

afterEach(() => cutIn(null));

describe("the line draws when there is a line", () => {
  // AND NOT BEFORE. Showing forward over an empty queue was the wrong fix for *"I want to move
  // forward"* — his correction: *"it's nice when you have a forward button, but there's nothing to
  // move forward to… the problem was, there's no new queue."* Filling the queue is the fix;
  // drawing a control that leads nowhere is not.
  // ONE ITEM IS A LINE. *"One person speaking with nothing else behind shows up in the queue."*
  it("draws with one row while a reply reads alone", () => {
    cutIn(row("only-one"));
    const { container } = render(<SpeechLine />);
    expect(view().waiting).toEqual([]);
    expect(container.querySelector(".speech-line")).not.toBeNull();
    expect(container.querySelectorAll(".speech-line__row")).toHaveLength(1);
    expect(screen.getByText("only-one")).toBeInTheDocument();
  });

  // AND FORWARD IS THE PART THAT WAITS. A skip with nothing behind it moves to nothing.
  it("withholds forward until there is something to move forward to", () => {
    cutIn(row("r1"));
    expect(screen.queryByTitle("Skip to the next one")).toBeNull();
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line__skip")).toBeNull();
    expect(container.querySelector(".speech-line__stop")).not.toBeNull();
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

  // SUPERSEDED. A waiting row's label used to navigate; he was explicit that a queue press moves
  // the READING — *"I was being distinct from that. Clearly. Purposely."* Going to the reply keeps
  // its own ⤴ door on the row.
  it("reaches a waiting row's reply through its own go-to door, not its label", () => {
    const went = [];
    cutIn(row("r1"));
    enqueue(row("later-one"));
    const { container } = render(<SpeechLine onGo={(k) => went.push(k)} />);
    fireEvent.click(container.querySelector(".speech-line__goto"));
    expect(went).toEqual(["later-one"]);
  });

  it("and pressing that row's LABEL moves the reading instead, leaving the view alone", () => {
    const went = [];
    cutIn(row("r1"));
    enqueue(row("later-one"));
    render(<SpeechLine onGo={(k) => went.push(k)} />);
    fireEvent.click(screen.getByText("later-one"));
    expect(view().playing.key).toBe("later-one");
    expect(went).toEqual([]);
  });

  it("does not offer the go-to door when nothing can open it", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line__text--go").disabled).toBe(true);
    expect(container.querySelector(".speech-line__goto").disabled).toBe(true);
  });

  it("going to a row does not remove it from the line, nor start it", () => {
    cutIn(row("r1"));
    enqueue(row("r2"));
    const { container } = render(<SpeechLine onGo={() => {}} />);
    fireEvent.click(container.querySelector(".speech-line__goto"));
    expect(view().waiting.map((w) => w.key)).toEqual(["r2"]);
    expect(view().playing.key).toBe("r1");
  });
});

// THE LINE IS THE FULL TRANSPORT. *"There's definitely times you scroll away from the play button…
// you can't pause it, you could only stop it. The queue should have the full functionality of
// whatever is playing so that you don't have to have it in view."*
describe("pause lives on the line, not only on the row", () => {
  it("offers pause whenever something is reading, with nothing behind it", () => {
    cutIn(row("r1"));
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line__pause")).not.toBeNull();
  });

  it("pressing it puts the line into paused, which is what says why it is silent", () => {
    cutIn(row("r1"));
    const { container } = render(<SpeechLine />);
    fireEvent.click(container.querySelector(".speech-line__pause"));
    expect(view().playing.paused).toBe(true);
    setPaused("r1", false);
  });

  it("and pressing it again resumes, rather than needing stop", () => {
    cutIn(row("r1"));
    const { container } = render(<SpeechLine />);
    fireEvent.click(container.querySelector(".speech-line__pause"));
    fireEvent.click(container.querySelector(".speech-line__pause"));
    expect(view().playing.paused).toBe(false);
  });

  it("shows nothing to pause when nothing is reading", () => {
    cutIn(null);
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line__pause")).toBeNull();
  });
});

// HIS CASE: *"in some cases you may be scrolled away from the thing that's loading"* — and a box
// selection has no row at all. The row's own "Loading" label cannot help in either, so the line
// has to say it.
describe("loading shows on the line, not only on the row", () => {
  it("says loading while whatever is playing is still warming up", () => {
    cutIn(row("sel-1"));
    setWarming("sel-1", true);
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line__stop").textContent).toContain("loading");
    expect(container.querySelector(".speech-line__row--reading.is-warming")).not.toBeNull();
    setWarming("sel-1", false);
  });

  it("stops saying it the moment the first sound arrives", () => {
    cutIn(row("sel-1"));
    setWarming("sel-1", true);
    const { container, rerender } = render(<SpeechLine />);
    setWarming("sel-1", false);
    rerender(<SpeechLine />);
    expect(container.querySelector(".speech-line__stop").textContent).not.toContain("loading");
  });

  it("paused outranks loading — a pause is the thing he needs explained", () => {
    cutIn(row("sel-1"));
    setWarming("sel-1", true);
    setPaused("sel-1", true);
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line__stop").textContent).toContain("paused");
    expect(container.querySelector(".speech-line__stop").textContent).not.toContain("loading");
    setPaused("sel-1", false);
    setWarming("sel-1", false);
  });

  it("ignores a warming report for something that is not playing", () => {
    cutIn(row("a"));
    expect(setWarming("someone-else", true)).toBe(false);
    const { container } = render(<SpeechLine />);
    expect(container.querySelector(".speech-line__stop").textContent).not.toContain("loading");
  });
});
