import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import HowWeWork from "./HowWeWork";

// A SMOKE TEST, and one real walk through the only live thing on the page. The page itself is
// markup and needs no snapshot — but it mounts on the surface a person lands on with nothing open,
// so "does it render at all" is worth a second, and the arc demo is genuine derivation.

describe("HowWeWork", () => {
  it("renders the whole page in a bare jsdom — no IntersectionObserver, no matchMedia", () => {
    render(<HowWeWork />);
    expect(screen.getByText("How this works")).toBeInTheDocument();
    expect(
      screen.getByText("The state is in the document, and nowhere else.")
    ).toBeInTheDocument();
    // the trail opens on the RFC's first station
    expect(screen.getByRole("heading", { level: 3, name: "draft" })).toBeInTheDocument();
  });

  it("the trail answers for the station you press", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: /GAP/ }));
    // scoped to the trail: the word also appears in the station's own prose
    const trail = document.querySelector(".hww-trail");
    fireEvent.click(within(trail).getByText("resolved"));
    expect(screen.getByRole("heading", { level: 3, name: "resolved" })).toBeInTheDocument();
    // the one state a press cannot outrun: pressing it with no proof OFFERS one
    expect(screen.getByText(/OFFERS one/)).toBeInTheDocument();
  });

  it("settling the plans walks the arc upward, and an unplanned objective holds it back", () => {
    render(<HowWeWork />);
    // RFC-073 and RFC-074 serve O1, RFC-075 serves O2, and O3 has no plan at all
    ["RFC-073", "RFC-074", "RFC-075"].forEach((id) => fireEvent.click(screen.getByText(id)));
    expect(screen.getByText(/has no plan attached/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("+ attach a plan"));
    expect(screen.getByText(/1 plan is still moving/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("RFC-076"));
    expect(screen.getByText(/derived upward, never pressed/)).toBeInTheDocument();
  });
});
