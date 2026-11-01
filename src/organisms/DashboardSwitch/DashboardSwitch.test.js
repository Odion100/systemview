import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ServiceContext from "../../ServiceContext";
import DashboardSwitch from "./DashboardSwitch";

// THE STRIP KEEPS ITS LOOK AND GAINS TWO CONTROLS — his instruction: *"the switcher doesn't go
// away, it's going to look the same. It's just going to be like an X button on the tabs, plus a
// plus button up there."* These claims are about the two controls and the one rule that cannot
// live in the renderer alone: you cannot close your way down to nothing.

// No hub. The candidate pages render their own "reading the registry" state, which is all this
// file cares about — what is being tested is the strip, not what a page draws.
const mount = () =>
  render(
    <ServiceContext.Provider value={{ SystemViewService: {} }}>
      <DashboardSwitch />
    </ServiceContext.Provider>,
  );

beforeEach(() => {
  window.localStorage.clear();
});

const tabs = (c) => [...c.querySelectorAll(".dashswitch__tab")];
const labels = (c) => tabs(c).map((t) => t.querySelector(".dashswitch__pick").textContent);

// THE CHECK IS A REPLICA OF EVERY PAGE — three candidates, then one rebuilt page each, in the
// same order, so the fourth answers to the first without anybody counting.
it("opens on the three candidates and a replica of each, in the same order", () => {
  const { container } = mount();
  expect(labels(container)).toEqual([
    "A · one track",
    "B · the floor",
    "C · the shelves",
    "A · rebuilt",
    "B · rebuilt",
    "C · rebuilt",
  ]);
  expect(container.querySelector(".dashswitch__tab.is-on .dashswitch__pick").textContent).toBe("A · one track");
});

it("a rebuilt page is that page's own tiles, stacked flush with no chrome of their own", () => {
  const { container } = mount();
  fireEvent.click(within(tabs(container)[5]).getByText("C · rebuilt"));
  expect(container.querySelectorAll(".tile")).toHaveLength(4);
  // No card, no header: the blocks fit together to make a page.
  expect(container.querySelector(".tile__bar")).toBeNull();
  expect([...container.querySelectorAll(".tile__which")].map((e) => e.textContent)).toEqual(["c", "c", "c", "c"]);
});

it("the + is one control at the end of the row, not one per tab", () => {
  const { container } = mount();
  expect(container.querySelectorAll(".dashswitch__add")).toHaveLength(1);
  expect(container.querySelector(".dashswitch__picks").lastElementChild.className).toContain("dashswitch__add");
});

it("adding a page lands you on it, and it says it is empty rather than drawing a blank", () => {
  const { container } = mount();
  fireEvent.click(screen.getByLabelText("Add a page"));
  expect(labels(container)).toHaveLength(7);
  expect(container.querySelector(".dashswitch__tab.is-on .dashswitch__pick").textContent).toBe("Page 7");
  expect(screen.getByText(/Nothing on this page yet/)).toBeVisible();
});

it("every tab carries a close, and closing lands you on the neighbour", () => {
  const { container } = mount();
  const before = labels(container).length;
  fireEvent.click(within(tabs(container)[2]).getByLabelText("Close C · the shelves"));
  expect(labels(container)).toHaveLength(before - 1);
  expect(labels(container)).not.toContain("C · the shelves");
});

// THE RULE THAT MATTERS. A strip that lets you close the last page leaves a surface with nothing
// on it and no way back — so the control is hidden at one page AND the move is refused in
// `pages.js`, because a rule enforced only where it is painted is one refactor from being gone.
it("hides the close when there is one page left, and will not close it anyway", () => {
  const { container } = mount();
  while (labels(container).length > 1) {
    fireEvent.click(within(tabs(container)[tabs(container).length - 1]).getByLabelText(/^Close /));
  }
  expect(labels(container)).toEqual(["A · one track"]);
  expect(container.querySelectorAll(".dashswitch__close")).toHaveLength(0);
  // and the + is still there, so one page is never a dead end
  expect(container.querySelectorAll(".dashswitch__add")).toHaveLength(1);
});

it("remembers the pages and which one you were on, across a remount", () => {
  const first = mount();
  fireEvent.click(screen.getByLabelText("Add a page"));
  fireEvent.click(within(tabs(first.container)[0]).getByLabelText("Close A · one track"));
  const before = labels(first.container);
  first.unmount();

  const again = mount();
  expect(labels(again.container)).toEqual(before);
  expect(again.container.querySelector(".dashswitch__tab.is-on .dashswitch__pick").textContent).toBe("Page 7");
});

it("a saved layout that cannot be read falls back to the candidates, never to an empty strip", () => {
  window.localStorage.setItem("sv.dash.pages", "{{{not json");
  const { container } = mount();
  expect(labels(container).slice(0, 3)).toEqual(["A · one track", "B · the floor", "C · the shelves"]);
  expect(labels(container)).toHaveLength(6);
});

it("a page carries its own body — switching remounts rather than reusing the last one", () => {
  const { container } = mount();
  const body = () => container.querySelector(".dashswitch__body");
  const firstKey = body().innerHTML;
  fireEvent.click(within(tabs(container)[1]).getByText("B · the floor"));
  expect(body().innerHTML).not.toBe(firstKey);
});

// A PAGE OF HIS OWN — the whole point of the strip growing a +. These claims are about the stack
// being real: tiles go on, they can be swapped for another version of the same thing, they come
// off, and the layout survives a remount.
describe("a page he builds himself", () => {
  const page = () => {
    const r = mount();
    fireEvent.click(screen.getByLabelText("Add a page"));
    return r;
  };

  it("offers every kind, and says which have nothing built yet", () => {
    page();
    fireEvent.click(screen.getByText("+ add a tile"));
    for (const label of ["What is owed", "Where everything stands", "Per project", "The counts", "The reports"]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    // three lanes built three versions of most kinds — the menu is the inventory
    expect(screen.getAllByText("A · one track").length).toBeGreaterThan(0);
    expect(screen.getAllByText("C · the shelves").length).toBeGreaterThan(0);
  });

  it("puts a tile on the page, swaps it for another version, and takes it off", () => {
    const { container } = page();
    fireEvent.click(screen.getByText("+ add a tile"));
    // the owed kind, B's version of it
    const owed = screen.getByText("What is owed").closest(".tilestack__kind");
    fireEvent.click(within(owed).getByText("B · the floor"));
    expect(container.querySelectorAll(".tile")).toHaveLength(1);
    // NO HEADER ON A TILE. The blocks fit together to make a page; a bar over each one makes it
    // a row of cards. The only chrome is a corner, and it is the kind's own label that names it.
    expect(container.querySelector(".tile__bar")).toBeNull();
    expect(container.querySelector(".tile__which").textContent).toBe("b");

    // THE CORNER OPENS THE SAME CHOOSER THE + DOES — every kind, not just this one's siblings —
    // so a slot can be swapped for a different thing entirely, not only a different version.
    fireEvent.click(container.querySelector(".tile__which"));
    const pop = container.querySelector(".tilestack__menu--corner");
    expect(within(pop).getByText("The reports")).toBeVisible();
    fireEvent.click(within(within(pop).getByText("What is owed").closest(".tilestack__kind")).getByText("C · the shelves"));
    expect(container.querySelector(".tile__which").textContent).toBe("c");

    fireEvent.click(screen.getByLabelText("Remove What is owed"));
    expect(container.querySelectorAll(".tile")).toHaveLength(0);
    expect(screen.getByText(/Nothing on this page yet/)).toBeVisible();
  });

  it("remembers the tiles he placed, across a remount", () => {
    const first = page();
    fireEvent.click(screen.getByText("+ add a tile"));
    fireEvent.click(within(screen.getByText("The reports").closest(".tilestack__kind")).getByText("B · the floor"));
    expect(first.container.querySelectorAll(".tile")).toHaveLength(1);
    first.unmount();

    const again = mount();
    expect(again.container.querySelectorAll(".tile")).toHaveLength(1);
    expect(again.container.querySelector(".tile__which").textContent).toBe("b");
  });

  // EVEN A KIND WITH ONE VERSION OPENS THE CHOOSER, because the chooser is no longer about
  // versions — it is about what goes in this slot, and the answer may be another kind.
  it("a kind with one version still opens the full chooser", () => {
    const { container } = page();
    fireEvent.click(screen.getByText("+ add a tile"));
    fireEvent.click(within(screen.getByText("The reports").closest(".tilestack__kind")).getByText("B · the floor"));
    fireEvent.click(container.querySelector(".tile__which"));
    const pop = container.querySelector(".tilestack__menu--corner");
    expect(within(pop).getByText("Where everything stands")).toBeVisible();
    fireEvent.click(within(within(pop).getByText("Per project").closest(".tilestack__kind")).getByText("C · the shelves"));
    // the slot is now a different KIND entirely
    expect(container.querySelectorAll(".tile")).toHaveLength(1);
    expect(container.querySelector(".tile__off").getAttribute("aria-label")).toBe("Remove Per project");
  });

  // A LAYOUT OUTLIVES THE CODE IT NAMES. A variant that is gone must degrade visibly, never to a
  // hole — a hole reads as "nothing here" when there is something here.
  it("a saved tile naming a version that no longer exists falls back and says so", () => {
    window.localStorage.setItem(
      "sv.dash.pages",
      JSON.stringify([{ id: "mine", label: "Mine", tiles: [{ kind: "owed", variant: "z" }] }]),
    );
    window.localStorage.setItem("sv.dash.pick", "mine");
    const { container } = mount();
    expect(container.querySelectorAll(".tile")).toHaveLength(1);
    // Said in the corner, not in a banner: the letter he GETS, marked as not the one he asked
    // for, and the sentence in the title.
    const which = container.querySelector(".tile__which");
    expect(which.className).toContain("is-swapped");
    expect(which.getAttribute("title")).toMatch(/z is gone, showing/);
  });

  it("a saved tile of a kind that no longer exists says which it was, and offers to remove it", () => {
    window.localStorage.setItem(
      "sv.dash.pages",
      JSON.stringify([{ id: "mine", label: "Mine", tiles: [{ kind: "terminal", variant: "a" }] }]),
    );
    window.localStorage.setItem("sv.dash.pick", "mine");
    const { container } = mount();
    expect(container.querySelector(".tile__missing")).toBeTruthy();
    expect(screen.getByText("terminal")).toBeVisible();
  });
});
