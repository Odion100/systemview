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

// ─── THE STRIP IS WIRED TO THE RANKS ──────────────────────────────────────────────────────────
//
// `tabOrder.test.js` holds the ordering to its rules. What a pure module cannot say is whether the
// COMPONENT is plugged into it — so these drive the real `sv:agentState` event, press real tabs,
// and read the strip back out of the DOM.
//
// AND THEY ARE WRITTEN AROUND THE TWO THINGS HE CAUGHT, because the first build failed both:
//   *"it moved in front of you, which should have just added to the end of you"*
//   *"why did it move away? it went back to where it was"*
describe("the strip is ordered by what he has been using", () => {
  const names = () => [...document.querySelectorAll(".system-nav__agenttab-name")].map((n) => n.textContent);
  const cooking = () =>
    [...document.querySelectorAll(".system-nav__agenttab")]
      .filter((t) => t.querySelector(".system-nav__agenttab-dot--cooking"))
      .map((t) => t.querySelector(".system-nav__agenttab-name").textContent);
  const tab = (pc) => [...document.querySelectorAll(".system-nav__agenttab")].find((t) => t.textContent.includes(pc));
  const working = (pc, state) =>
    act(() => {
      window.dispatchEvent(new CustomEvent("sv:agentState", { detail: { projectCode: pc, state } }));
    });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("sv.navView", "tabs");
    localStorage.setItem("sv.navTabPc", "alpha"); // he is in alpha
    localStorage.setItem("sv.husks", JSON.stringify(["alpha", "beta", "gamma"].map((projectCode) => ({ projectCode }))));
    localStorage.setItem("sv.dockOrder", JSON.stringify(["alpha", "beta", "gamma"]));
  });
  afterEach(() => localStorage.clear());

  // ─── HIS FIRST COMPLAINT ─────────────────────────────────────────────────────────────────────
  it("brings a working agent forward BEHIND the tab he is in, never over it", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    expect(names()).toEqual(["alpha", "beta", "gamma"]);

    // GAMMA STARTS WORKING — it comes forward, and alpha keeps the front because he is in it
    working("gamma", "working");
    expect(names()).toEqual(["alpha", "gamma", "beta"]);
    expect(cooking()).toEqual(["gamma"]);

    // A SECOND ONE lands behind the first — nothing already forward moves
    working("beta", "working");
    expect(names()).toEqual(["alpha", "gamma", "beta"]);
    expect(cooking()).toEqual(["gamma", "beta"]);
  });

  // ─── HIS SECOND COMPLAINT ────────────────────────────────────────────────────────────────────
  it("does not put a finished agent back where it was", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    working("gamma", "working");
    expect(names()).toEqual(["alpha", "gamma", "beta"]);

    // gamma finishes. The DOT goes out — that is about what is happening. The PLACE is kept, for
    // good: the whole value of it having come forward is that it is still there to be found.
    working("gamma", "idle");
    expect(cooking()).toEqual([]);
    expect(names()).toEqual(["alpha", "gamma", "beta"]);

    // and it does not drift back later either — there is no state that undoes a place
    working("beta", "working");
    working("beta", "idle");
    expect(names()).toEqual(["alpha", "gamma", "beta"]);
  });

  it("survives a reload where it got to, rather than reverting", async () => {
    const { unmount } = render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    working("gamma", "working");
    working("gamma", "idle");
    expect(names()).toEqual(["alpha", "gamma", "beta"]);
    unmount();

    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    expect(names()).toEqual(["alpha", "gamma", "beta"]);
  });

  it("puts the tab he presses at the front, and it outranks any agent's own announcement", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    working("gamma", "working");
    expect(names()).toEqual(["alpha", "gamma", "beta"]);

    // HE OPENS BETA — usage is the strongest claim, so beta goes to the front over a working gamma
    act(() => {
      fireEvent.click(tab("beta"));
    });
    expect(names()).toEqual(["beta", "alpha", "gamma"]);
    // and gamma working on cannot climb back over either of his
    working("gamma", "working");
    expect(names()).toEqual(["beta", "alpha", "gamma"]);
  });

  // RECENCY IS RECENCY, NOT FIRST-SEEN. Found by mutation: removing the rank from the press alone
  // changed nothing, because the cold-start effect ranks whatever tab he lands in — but only the
  // FIRST time it sees it. So going back to a tab he used earlier has to move it again, and that
  // is the case that tells the two paths apart.
  it("moves a tab he goes BACK to, not only one he opens for the first time", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    act(() => {
      fireEvent.click(tab("beta"));
    });
    expect(names()).toEqual(["beta", "alpha", "gamma"]);
    act(() => {
      fireEvent.click(tab("gamma"));
    });
    expect(names()).toEqual(["gamma", "beta", "alpha"]);
    // BACK TO BETA, which he has already used — it has to come forward again
    act(() => {
      fireEvent.click(tab("beta"));
    });
    expect(names()).toEqual(["beta", "gamma", "alpha"]);
  });

  it("holds completely still while his pointer is on the strip", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab-dot").length).toBe(3));
    const strip = document.querySelector(".system-nav__agenttabs");

    act(() => {
      fireEvent.pointerEnter(strip);
    });
    working("gamma", "working");
    expect(names()).toEqual(["alpha", "beta", "gamma"]);
    // the MARK still lands — what is frozen is the order, never the truth about who is working
    expect(cooking()).toEqual(["gamma"]);

    act(() => {
      fireEvent.pointerLeave(strip);
    });
    expect(names()).toEqual(["alpha", "gamma", "beta"]);
  });
});

// ─── CARRYING AN AGENT BACK INTO THE STRIP ─────────────────────────────────────────────────────
//
// *"If I pull it out, I should be able to move it and drop it back into the tabs."* And then, when
// the first build docked it but left the order alone: *"it's not changing the order. I need to be
// able to pick exactly where I drop it."*
//
// jsdom HAS NO LAYOUT, so every rect is zero and a drop index measured off them would be
// meaningless — the rects are stubbed per tab, which is the only way an index test here says
// anything at all.
describe("carrying an agent back into the strip", () => {
  const names = () => [...document.querySelectorAll(".system-nav__agenttab-name")].map((n) => n.textContent);
  const line = () => document.querySelector(".system-nav__agenttab-line");
  const carryTo = (pc, x) =>
    act(() => {
      window.dispatchEvent(new CustomEvent("sv:carry", { detail: { projectCode: pc, x, y: 10 } }));
    });
  const dropAtX = (pc, x) =>
    act(() => {
      window.dispatchEvent(new CustomEvent("sv:carried", { detail: { projectCode: pc, x, y: 10 } }));
    });

  // THE STRIP SPANS 0–300 AND EACH TAB IS 100 WIDE, so the midpoints are 50, 150 and 250 — the
  // boundaries a drop is measured against.
  const stubRects = () => {
    const strip = document.querySelector(".system-nav__agenttabs");
    strip.getBoundingClientRect = () => ({ left: 0, right: 300, top: 0, bottom: 20, width: 300, height: 20 });
    [...strip.querySelectorAll(".system-nav__agenttab")].forEach((t, i) => {
      t.getBoundingClientRect = () => ({ left: i * 100, right: i * 100 + 100, top: 0, bottom: 20, width: 100, height: 20 });
    });
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("sv.navView", "tabs");
    localStorage.setItem("sv.navTabPc", "alpha");
    localStorage.setItem("sv.husks", JSON.stringify(["alpha", "beta", "gamma"].map((projectCode) => ({ projectCode }))));
    localStorage.setItem("sv.dockOrder", JSON.stringify(["alpha", "beta", "gamma"]));
  });
  afterEach(() => localStorage.clear());

  it("draws a line where the drop would land, and no line when the pointer is off the strip", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab").length).toBe(3));
    stubRects();
    expect(line()).toBeNull();

    // over the first half of the first tab — it would land at the very front
    carryTo("gamma", 10);
    expect(line()).not.toBeNull();
    expect(line().nextElementSibling.textContent).toContain("alpha");

    // past the middle of the second tab — it would land after beta
    carryTo("gamma", 180);
    expect(line().nextElementSibling.textContent).toContain("gamma");

    // OFF THE STRIP, NO LINE. A drop out there is not this strip's business.
    carryTo("gamma", 900);
    expect(line()).toBeNull();
  });

  it("lands the agent exactly where the line was, and docks it", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab").length).toBe(3));
    stubRects();
    expect(names()).toEqual(["alpha", "beta", "gamma"]);

    // carried to the front and let go there
    carryTo("gamma", 10);
    dropAtX("gamma", 10);
    expect(names()).toEqual(["gamma", "alpha", "beta"]);
    expect(line()).toBeNull();
    // and it is home — docked, so its tab wears the agent again
    expect(document.querySelector(".system-nav__agenttab").textContent).toContain("🤖");
  });

  it("leaves the order alone when the agent is dropped anywhere else", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab").length).toBe(3));
    stubRects();
    carryTo("gamma", 10);
    dropAtX("gamma", 900); // let go out over the page
    expect(names()).toEqual(["alpha", "beta", "gamma"]);
    expect(line()).toBeNull();
  });

  it("a drop STICKS — the next agent to start working cannot take its place", async () => {
    render(<SystemNavigator />);
    await waitFor(() => expect(document.querySelectorAll(".system-nav__agenttab").length).toBe(3));
    stubRects();
    carryTo("gamma", 10);
    dropAtX("gamma", 10);
    expect(names()).toEqual(["gamma", "alpha", "beta"]);

    act(() => {
      window.dispatchEvent(new CustomEvent("sv:agentState", { detail: { projectCode: "beta", state: "working" } }));
    });
    expect(names()).toEqual(["gamma", "alpha", "beta"]);
  });
});
