/* eslint-disable jest/valid-expect */
import React from "react";
import ReactDom from "react-dom";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import SystemNavigator from "./SystemNavigator";

// THE LIVE SESSIONS ARE THE HOST'S, so they are the one thing stubbed — and they have to be, or
// the working DOT never renders at all and an assertion about it passes over nothing.
jest.mock("../../utils/hostAgents", () => ({
  ...jest.requireActual("../../utils/hostAgents"),
  liveSessions: async () => ["alpha", "beta", "gamma"].map((projectCode) => ({ projectCode })),
}));

// The old fixture passed a `servicesList` prop the component never accepted — a remnant of the
// pre-transition tree. Services arrive through ServiceContext now; the smoke test just mounts.
describe("<SystemNavigator/>", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    ReactDom.render(<SystemNavigator />, div);
  });
});

// ─── THE STRIP IS WIRED TO THE ANNOUNCEMENT ────────────────────────────────────────────────────
//
// `tabOrder.test.js` holds the ordering to its rules. What a pure module cannot say is whether the
// COMPONENT is actually plugged into it — so these drive the real `sv:agentState` event and read
// the tabs back out of the DOM, which is the only thing that proves the wire.
describe("the working agents come to the front of the strip", () => {
  const names = () => [...document.querySelectorAll(".system-nav__agenttab-name")].map((n) => n.textContent);
  const cooking = () =>
    [...document.querySelectorAll(".system-nav__agenttab")]
      .filter((t) => t.querySelector(".system-nav__agenttab-dot--cooking"))
      .map((t) => t.querySelector(".system-nav__agenttab-name").textContent);
  const working = (pc, state) =>
    act(() => {
      window.dispatchEvent(new CustomEvent("sv:agentState", { detail: { projectCode: pc, state } }));
    });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("sv.navView", "tabs");
    localStorage.setItem("sv.husks", JSON.stringify(["alpha", "beta", "gamma"].map((projectCode) => ({ projectCode }))));
    localStorage.setItem("sv.dockOrder", JSON.stringify(["alpha", "beta", "gamma"]));
  });
  afterEach(() => localStorage.clear());

  it("moves a working agent to the front, and a second one lands BEHIND it rather than above it", async () => {
    render(<SystemNavigator />);
    expect(names()).toEqual(["alpha", "beta", "gamma"]);
    // the dots arrive with the host's answer — without them the mark assertions below say nothing
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));

    // GAMMA STARTS WORKING — it comes to him rather than him going to find it
    working("gamma", "working");
    expect(names()).toEqual(["gamma", "alpha", "beta"]);
    expect(cooking()).toEqual(["gamma"]);

    // A SECOND ONE STARTS and lands BEHIND gamma — nothing already up front moves
    working("beta", "working");
    expect(names()).toEqual(["gamma", "beta", "alpha"]);
    expect(cooking()).toEqual(["gamma", "beta"]);
  });

  it("holds completely still while his pointer is on the strip", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    const strip = document.querySelector(".system-nav__agenttabs");

    act(() => {
      fireEvent.pointerEnter(strip);
    });
    // GAMMA STARTS WHILE HE IS HOVERING. It would otherwise jump to the front; it does not move,
    // because a tab that moves out from under a click is worse than a tab he had to look for.
    working("gamma", "working");
    expect(names()).toEqual(["alpha", "beta", "gamma"]);
    // the MARK still lands — what is frozen is the order, never the truth about who is working
    expect(cooking()).toEqual(["gamma"]);

    act(() => {
      fireEvent.pointerLeave(strip);
    });
    expect(names()).toEqual(["gamma", "alpha", "beta"]);
  });

  it("does not yank the strip around when an agent FINISHES", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    working("gamma", "working");
    expect(names()).toEqual(["gamma", "alpha", "beta"]);

    // gamma goes quiet. The dot goes out immediately; the PLACE is held through the afterglow,
    // because a tab that moved because something ENDED is the least useful movement there is.
    working("gamma", "idle");
    expect(cooking()).toEqual([]);
    expect(names()).toEqual(["gamma", "alpha", "beta"]);
  });
});
