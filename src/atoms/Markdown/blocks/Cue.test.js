import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Cue from "./Cue";

// the scope hook reads the URL when no provider answers — a router is the one thing it needs here
const draw = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

// The rendered cue row — a neat command log: verb, label, a play press. `call` renders honest:
// designed, not wired, and nothing pretends to run it.
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

  it("a call cue says it is not wired, and has nothing to press", () => {
    draw(<Cue attrs={{ call: "Window.readState" }} label="" />);
    expect(screen.getByText("call")).toBeInTheDocument();
    expect(screen.getByText("not wired yet")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
