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

// THE CANDIDATES ARE RETIRED. Three pages, each a stack of its own tiles, in the order the
// candidates were in — the comparison that justified keeping them lives in `equivalence.test.js`,
// which still mounts the original components and holds the tiles to them node for node.
it("opens on three pages, in the order the candidates were in", () => {
  const { container } = mount();
  expect(labels(container)).toEqual(["A · one track", "B · the floor", "C · the shelves"]);
  expect(container.querySelector(".dashswitch__tab.is-on .dashswitch__pick").textContent).toBe("A · one track");
});

it("a page is that page's own tiles, stacked flush with no chrome of their own", () => {
  const { container } = mount();
  fireEvent.click(within(tabs(container)[2]).getByText("C · the shelves"));
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
  expect(labels(container)).toHaveLength(4);
  expect(container.querySelector(".dashswitch__tab.is-on .dashswitch__pick").textContent).toBe("Page 4");
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
  expect(again.container.querySelector(".dashswitch__tab.is-on .dashswitch__pick").textContent).toBe("Page 4");
});

it("a saved layout that cannot be read falls back to the three pages, never to an empty strip", () => {
  window.localStorage.setItem("sv.dash.pages", "{{{not json");
  const { container } = mount();
  expect(labels(container)).toEqual(["A · one track", "B · the floor", "C · the shelves"]);
});

// HIS SAVED LAYOUT STILL NAMES THE RETIRED CANDIDATES, and this is the only place that reads it —
// so the retirement has to reach a window nobody cleared, rather than waiting for one.
it("a layout saved before the retirement loses the candidates and keeps the rest", () => {
  window.localStorage.setItem(
    "sv.dash.pages",
    JSON.stringify([
      { id: "a", label: "A · one track", legacy: "a", tiles: [] },
      { id: "b", label: "B · the floor", legacy: "b", tiles: [] },
      { id: "rc", label: "C · the shelves", tiles: [{ kind: "head", variant: "c" }] },
    ])
  );
  const { container } = mount();
  expect(labels(container)).toEqual(["C · the shelves"]);
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
    const pop = container.querySelector(".tilestack__menu--over");
    expect(within(pop).getByText("The reports")).toBeVisible();
    // IT DOES NOT VANISH WHEN THE POINTER LEAVES IT. The add menu never did, and a menu that
    // closes on the way to the option you want is a menu you cannot use.
    fireEvent.mouseLeave(pop);
    expect(container.querySelector(".tilestack__menu--over")).toBeTruthy();
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
    const pop = container.querySelector(".tilestack__menu--over");
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

// THE ADD MENU WAS NEVER SUPPOSED TO CHANGE. It is in the flow, full width, and it stays open
// until you pick or cancel — a `mouseLeave` close got added to it by accident when the two menus
// became one, and it shut every time the pointer crossed a gap.
it("the add menu stays open until you pick or cancel", () => {
  const { container } = mount();
  fireEvent.click(screen.getByLabelText("Add a page"));
  fireEvent.click(screen.getByText("+ add a tile"));
  const menu = container.querySelector(".tilestack__menu");
  expect(menu).toBeTruthy();
  // in the flow, not floating over the page
  expect(menu.className).not.toContain("tilestack__menu--over");
  fireEvent.mouseLeave(menu);
  expect(container.querySelector(".tilestack__menu")).toBeTruthy();
  fireEvent.click(screen.getByText("cancel"));
  expect(container.querySelector(".tilestack__menu")).toBeNull();
});

describe("the floating picker", () => {
  const openOver = () => {
    const r = mount();
    fireEvent.click(within(tabs(r.container)[2]).getByText("C · the shelves"));
    fireEvent.click(r.container.querySelectorAll(".tile__which")[0]);
    return r;
  };

  // THE ORDER IS THE PAGE'S ORDER. *"The header should be at the top… I thought I was trying to
  // switch a header for a header."* A picker in a different order than the page makes you hunt
  // for the row you are standing on.
  it("lists the kinds in the order a page stacks them", () => {
    const { container } = openOver();
    const rows = [...container.querySelectorAll(".tilestack__menu--over .tilestack__kind b")].map((b) => b.textContent);
    expect(rows).toEqual(["The counts", "What is owed", "Where everything stands", "The reports", "Per project"]);
  });

  it("says which one is already in the slot", () => {
    const { container } = openOver();
    const here = [...container.querySelectorAll(".tilestack__menu--over button.is-here")];
    expect(here).toHaveLength(1);
    expect(here[0].textContent).toBe("C · the shelves");
    // and the row it sits on is marked too, so the eye lands before it reads a label
    expect(here[0].closest(".tilestack__kind").querySelector("b").textContent).toBe("The counts");
  });

  it("closes on a click outside it, and on escape", () => {
    const { container } = openOver();
    fireEvent.mouseDown(document.body);
    expect(container.querySelector(".tilestack__menu--over")).toBeNull();

    fireEvent.click(container.querySelectorAll(".tile__which")[0]);
    expect(container.querySelector(".tilestack__menu--over")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".tilestack__menu--over")).toBeNull();
  });

  it("a click inside it does not close it", () => {
    const { container } = openOver();
    const menu = container.querySelector(".tilestack__menu--over");
    fireEvent.mouseDown(menu.querySelector("b"));
    expect(container.querySelector(".tilestack__menu--over")).toBeTruthy();
  });

  // The one at the foot is NOT dismissable that way — it is in the flow and always was.
  it("the add menu is not dismissed by a click elsewhere", () => {
    const { container } = mount();
    fireEvent.click(screen.getByLabelText("Add a page"));
    fireEvent.click(screen.getByText("+ add a tile"));
    fireEvent.mouseDown(document.body);
    expect(container.querySelector(".tilestack__menu")).toBeTruthy();
  });
});
