import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Cue from "./Cue";

// the scope hook reads the URL when no provider answers — a router is the one thing it needs here
const draw = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

// The rendered cue row — a neat command log: verb, label, a play press. `call` renders honest:
// every verb carries a play, `call` included — it drives the window's own commands now.
describe("::cue", () => {
  it("a say cue shows its prose and offers play", () => {
    draw(<Cue attrs={{}} label="welcome to the tour" />);
    expect(screen.getByText("say")).toBeInTheDocument();
    expect(screen.getByText("welcome to the tour")).toBeInTheDocument();
    expect(screen.getByTitle("play this cue")).toBeInTheDocument();
  });

  it("a point cue wears its say-label, not the selector", () => {
    draw(<Cue attrs={{ at: ".hww-intro", say: "the path" }} label="" />);
    expect(screen.getByText("point")).toBeInTheDocument();
    expect(screen.getByText("the path")).toBeInTheDocument();
  });

  it("a call cue reads as a command and carries a play like any other beat", () => {
    // It used to render "not wired yet" with nothing to press, which was the honest thing to draw
    // while it was a stub. It drives nav / act / show / refresh now, so the row is a control.
    draw(<Cue attrs={{ call: "nav report=meetings/x.md" }} label="" />);
    expect(screen.getByText("call")).toBeInTheDocument();
    expect(screen.getByText("nav report=meetings/x.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });
});
