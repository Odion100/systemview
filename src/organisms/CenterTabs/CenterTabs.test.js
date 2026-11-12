// THE STRIP'S VERBS, AS CLAIMS — CenterTabs is the one tab strip two pages now mount over one
// store, and until this file existed the proof of the extraction was "press it
// and see". These claims render the real component over the REAL tabsStore — a mocked store would
// test the mock's idea of close-right — with a fresh project key per test so no state crosses.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CenterTabs from "./CenterTabs";
import { openTab, getTabs, fileKey, __resetStore } from "../../pages/SystemView/tabsStore";

// THE STORE IS THE WINDOW'S NOW, not one per project (2026-11-12) — so these cases share it, and
// each one starts from an empty strip rather than inheriting the last one's tabs. Before the change
// a different `tabsPc` per case was isolation enough; it is not any more.
beforeEach(() => {
  localStorage.clear();
  __resetStore();
});

let n = 0;
const freshPc = () => `ct-test-${++n}`;

const fileTab = (path, extra = {}) => ({
  key: fileKey({ projectCode: "", path }),
  kind: "file",
  file: { projectCode: "", path, ...extra },
});

const seed = (pc, paths) => {
  for (const p of paths) openTab(pc, fileTab(p));
  return getTabs(pc).panes[0].tabs;
};

const mount = (pc, over = {}) => {
  const props = {
    tabsPc: pc,
    tabs: getTabs(pc).panes[0].tabs,
    isActive: () => false,
    onOpen: jest.fn(),
    afterClose: jest.fn(),
    ...over,
  };
  const r = render(<CenterTabs {...props} />);
  return { ...r, props };
};

describe("the floor", () => {
  it("shows a synthetic SystemView tab when nothing is open — named, not empty chrome", () => {
    mount(freshPc());
    expect(screen.getByText("SystemView")).toBeInTheDocument();
    // Synthetic: it is the nothing-open state, so there is nothing to close.
    expect(screen.queryByTitle("Close")).not.toBeInTheDocument();
  });
});

describe("tabs and the store", () => {
  it("renders each tab by its label and opens on a face click", () => {
    const pc = freshPc();
    seed(pc, ["src/a.js", "src/b.js"]);
    const { props } = mount(pc);
    fireEvent.click(screen.getByText("b.js"));
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    expect(props.onOpen.mock.calls[0][0].file.path).toBe("src/b.js");
  });

  it("close removes the tab from the store, and afterClose fires ONLY when the closed tab was active", () => {
    const pc = freshPc();
    const [a] = seed(pc, ["src/a.js", "src/b.js"]);
    // Closing an inactive tab: the store shrinks, the view is not moved.
    const inactive = mount(pc, { isActive: () => false });
    fireEvent.click(inactive.container.querySelectorAll(".doc-tab__close")[0]);
    expect(getTabs(pc).panes[0].tabs.map((t) => t.file.path)).toEqual(["src/b.js"]);
    expect(inactive.props.afterClose).not.toHaveBeenCalled();
    inactive.unmount();
    // Closing the active tab: afterClose carries the next key and the closed tab.
    const active = mount(pc, { tabs: getTabs(pc).panes[0].tabs, isActive: () => true });
    fireEvent.click(active.container.querySelector(".doc-tab__close"));
    expect(getTabs(pc).panes[0].tabs).toEqual([]);
    expect(active.props.afterClose).toHaveBeenCalledTimes(1);
    const [nextKey, closed] = active.props.afterClose.mock.calls[0];
    expect(nextKey).toBeNull();
    expect(closed.file.path).toBe("src/b.js");
    expect(closed.key).not.toBe(a.key);
  });

  it("drop on a tab reorders in the store — the dragged tab lands where the target SAT, pushing it right", () => {
    const pc = freshPc();
    const [a] = seed(pc, ["src/a.js", "src/b.js", "src/c.js"]);
    mount(pc);
    const faces = screen.getAllByText(/\.js$/).map((el) => el.closest(".doc-tab"));
    fireEvent.drop(faces[2], {
      dataTransfer: { getData: () => a.key, types: ["text/sv-tab"] },
    });
    expect(getTabs(pc).panes[0].tabs.map((t) => t.file.path)).toEqual(["src/b.js", "src/a.js", "src/c.js"]);
    // Dropping PAST the tabs — on the scroll row itself — sends it last; the row owns that drop.
    fireEvent.drop(faces[2].parentElement, {
      dataTransfer: { getData: () => a.key, types: ["text/sv-tab"] },
    });
    expect(getTabs(pc).panes[0].tabs.map((t) => t.file.path)).toEqual(["src/b.js", "src/c.js", "src/a.js"]);
  });
});

describe("the right-click menu — a verb that would do nothing is HIDDEN, not greyed", () => {
  const open = (label) => fireEvent.contextMenu(screen.getByText(label));

  it("one tab: Close and Close all, nothing about 'others' or 'to the right'", () => {
    const pc = freshPc();
    seed(pc, ["src/only.js"]);
    mount(pc);
    open("only.js");
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Close all 1")).toBeInTheDocument();
    expect(screen.queryByText(/to the right/)).not.toBeInTheDocument();
    expect(screen.queryByText("Close others")).not.toBeInTheDocument();
  });

  it("first of three: the full menu, with the right count to the right", () => {
    const pc = freshPc();
    seed(pc, ["src/a.js", "src/b.js", "src/c.js"]);
    mount(pc);
    open("a.js");
    expect(screen.getByText("Close 2 to the right")).toBeInTheDocument();
    expect(screen.getByText("Close others")).toBeInTheDocument();
    expect(screen.getByText("Close all 3")).toBeInTheDocument();
  });

  it("menu verbs act on the store: Close others keeps only the aimed tab", () => {
    const pc = freshPc();
    seed(pc, ["src/a.js", "src/b.js", "src/c.js"]);
    mount(pc);
    open("b.js");
    fireEvent.click(screen.getByText("Close others"));
    expect(getTabs(pc).panes[0].tabs.map((t) => t.file.path)).toEqual(["src/b.js"]);
  });

  it("Close all above two tabs is TWO-STEP — the one strip verb you cannot undo by clicking the tree", () => {
    const pc = freshPc();
    seed(pc, ["src/a.js", "src/b.js", "src/c.js"]);
    mount(pc);
    open("a.js");
    fireEvent.click(screen.getByText("Close all 3"));
    // Armed, not done: the store still holds all three until the confirm.
    expect(getTabs(pc).panes[0].tabs).toHaveLength(3);
    fireEvent.click(screen.getByText("✓"));
    expect(getTabs(pc).panes[0].tabs).toEqual([]);
  });

  it("host menu items ride the same menu", () => {
    const pc = freshPc();
    seed(pc, ["src/a.js"]);
    const action = jest.fn();
    mount(pc, { extraMenuItems: () => [{ label: "Reveal in tree", action }] });
    open("a.js");
    fireEvent.click(screen.getByText("Reveal in tree"));
    expect(action).toHaveBeenCalled();
  });
});

describe("the + door", () => {
  it("renders only when the host supplies it, and the button toggles it open", () => {
    const pc = freshPc();
    const noPlus = mount(pc);
    expect(noPlus.container.querySelector(".doc-tabs__plus")).toBeNull();
    noPlus.unmount();
    const setOpen = jest.fn();
    mount(freshPc(), { plus: { open: false, path: "", err: "", recents: [], setOpen, setPath: () => {}, submit: () => {} } });
    fireEvent.click(screen.getByTitle(/Open a file by path/));
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it("open, it shows the input, a refusal, and recents that submit on click", () => {
    const submit = jest.fn();
    mount(freshPc(), {
      plus: { open: true, path: "~/x.md", err: "no file at that path", recents: ["~/.autobot/presence.md"], setOpen: () => {}, setPath: () => {}, submit },
    });
    expect(screen.getByText("no file at that path")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByDisplayValue("~/x.md"), { key: "Enter" });
    expect(submit).toHaveBeenCalledWith("~/x.md");
    fireEvent.click(screen.getByText("~/.autobot/presence.md"));
    expect(submit).toHaveBeenCalledWith("~/.autobot/presence.md");
  });
});

// THE TWO DOORS STAND OUTSIDE THE SCROLLER, and that is a structural claim rather than a
// cosmetic one: inside it, a door can only pretend to hold still — it needs `position: sticky`,
// a pin releases at its own scroll offset, and two doors pinned to one edge slide against each
// other while the + paints through them. jsdom lays nothing out, so the only thing worth
// asserting is the one thing that caused it: whose child each button is.
describe("the doors onto centre tabs", () => {
  it("are the strip's tail, not items in the scrolling row", () => {
    const pc = freshPc();
    seed(pc, ["src/a.js"]);
    const { container } = mount(pc);
    const doors = container.querySelector(".doc-tabs__doors");
    expect(doors).not.toBeNull();
    // A direct child of the strip — a sibling of the scroll area, never inside it.
    expect(doors.parentElement.className).toContain("doc-tabs");
    expect(doors.parentElement.className).not.toContain("doc-tabs__scroll");
    expect(container.querySelectorAll(".doc-tabs__scroll .doc-tabs__how")).toHaveLength(0);
    // Both of them, in the order they read: help first, then the dashboard.
    const glyphs = [...doors.querySelectorAll(".doc-tabs__how")];
    expect(glyphs).toHaveLength(2);
    expect(glyphs[1].className).toContain("doc-tabs__dash");
    // THE HELP DOOR WEARS THE APP'S OWN HELP ICON. There is one thing in this window that means
    // "explain this to me" — the ringed ? beside the scratchpad, saved tests and the nav — and a
    // second glyph invented for this door would make two.
    expect(glyphs[0].className).toContain("help-icon");
    expect(glyphs[0].textContent.trim()).toBe("?");
  });

  it("each opens its own centre kind, offering it to the host first", () => {
    const pc = freshPc();
    const heard = [];
    const listen = (e) => heard.push(e.detail.kind);
    window.addEventListener("sv:openCenterKind", listen);
    const onOpen = jest.fn();
    mount(pc, { onOpen });
    fireEvent.click(screen.getByTitle(/How we work/));
    fireEvent.click(screen.getByTitle(/^Dashboard/));
    window.removeEventListener("sv:openCenterKind", listen);
    expect(heard).toEqual(["how", "dash"]);
    // Nobody claimed it, so this strip's host opened both itself.
    expect(onOpen.mock.calls.map((c) => c[0].kind)).toEqual(["how", "dash"]);
  });
});

// A TAB THAT ARRIVES BESIDE YOU HAS TO ANNOUNCE ITSELF. Following a reference no longer moves
// you, and the cost of nothing moving is that nothing says anything happened.
describe("a tab that just arrived", () => {
  it("flashes the new one and nothing else, and not on first paint", () => {
    const pc = freshPc();
    seed(pc, ["src/a.js", "src/b.js"]);
    const { container, rerender, props } = mount(pc);
    // RESTORED TABS DO NOT FLASH — the strip comes back from the store on every mount, and
    // flashing what is merely already open makes a page load a light show.
    expect(container.querySelectorAll(".doc-tab--fresh")).toHaveLength(0);

    openTab(pc, fileTab("src/c.js"));
    rerender(
      <CenterTabs {...props} tabs={getTabs(pc).panes[0].tabs} />,
    );
    const fresh = [...container.querySelectorAll(".doc-tab--fresh")];
    expect(fresh).toHaveLength(1);
    expect(fresh[0].textContent).toContain("c.js");
  });
});

// THE SPLIT, FROM THE STRIP'S SIDE. The store's own claims cover what a split IS; these cover the
// three things the strip decides: which side a drop crossed to, which side's tabs a menu is
// counting, and which side the next document opens on.
describe("two strips, one store", () => {
  // A SPLIT IS SET UP THROUGH THE STORE, never by hand-building state — the point of these claims
  // is the strip over the real store, and a fabricated two-pane object would only prove the
  // fabrication was shaped right.
  const split = (pc, paths) => {
    const tabs = seed(pc, paths);
    const { splitTab } = require("../../pages/SystemView/tabsStore");
    splitTab(pc, tabs[tabs.length - 1].key);
    return getTabs(pc);
  };

  it("a drop on the OTHER side's strip crosses the divider — the document changes sides", () => {
    const pc = freshPc();
    const state = split(pc, ["src/a.js", "src/b.js", "src/c.js"]);
    expect(state.panes.map((p) => p.tabs.length)).toEqual([2, 1]);
    const moving = state.panes[0].tabs[0].key; // a.js, on the left
    // The right-hand strip, mounted as pane 1 — which is the only thing that tells it that a tab
    // arriving from pane 0 is a CROSSING and not a reorder.
    const right = mount(pc, { tabs: state.panes[1].tabs, pane: 1 });
    fireEvent.drop(right.container.querySelector(".doc-tab"), {
      dataTransfer: { getData: () => moving, types: ["text/sv-tab"] },
    });
    const after = getTabs(pc);
    expect(after.panes[0].tabs.map((t) => t.file.path)).toEqual(["src/b.js"]);
    // It landed WHERE IT WAS DROPPED, not merely on the far side — a crossing is as precise as a
    // reorder, which is what `before` carries.
    expect(after.panes[1].tabs.map((t) => t.file.path)).toEqual(["src/a.js", "src/c.js"]);
  });

  // THE SILENT FAULT THIS GUARDS. `moveTab` finds a tab by key wherever it lives and reorders it
  // inside ITS OWN pane — so a cross-pane drop treated as a reorder shuffles the document on the
  // side he dragged it out of, nothing crosses, and nothing says so.
  it("a drop inside its own side is still only a reorder — no pane is created or emptied", () => {
    const pc = freshPc();
    const state = split(pc, ["src/a.js", "src/b.js", "src/c.js"]);
    const left = mount(pc, { tabs: state.panes[0].tabs, pane: 0 });
    const faces = [...left.container.querySelectorAll(".doc-tab")];
    // b.js dropped onto a.js: it lands where a.js sat and pushes it right.
    fireEvent.drop(faces[0], { dataTransfer: { getData: () => state.panes[0].tabs[1].key, types: ["text/sv-tab"] } });
    const after = getTabs(pc);
    expect(after.panes.map((p) => p.tabs.map((t) => t.file.path))).toEqual([["src/b.js", "src/a.js"], ["src/c.js"]]);
  });

  it("the menu counts the side it was pressed on, not pane 0", () => {
    const pc = freshPc();
    const state = split(pc, ["src/a.js", "src/b.js", "src/c.js"]);
    mount(pc, { tabs: state.panes[1].tabs, pane: 1 });
    fireEvent.contextMenu(screen.getByText("c.js"));
    // One tab on this side. Counting `panes[0]` would have offered "Close all 2" — the most
    // alarming thing a confirm could get wrong.
    expect(screen.getByText("Close all 1")).toBeInTheDocument();
    expect(screen.queryByText("Close all 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Close others")).not.toBeInTheDocument();
  });

  it("the split verb is named for what it will do, and refuses when there is nothing to leave behind", () => {
    const only = freshPc();
    seed(only, ["src/solo.js"]);
    mount(only);
    fireEvent.contextMenu(screen.getByText("solo.js"));
    // Splitting the only tab on the only pane would empty its own origin — a focus change with
    // extra steps — so the row is absent rather than offered dead.
    expect(screen.queryByText(/Split/)).not.toBeInTheDocument();

    // A SECOND SCENARIO IN THE SAME CASE, and the strip is the window's — so a fresh project code
    // no longer gives it a fresh strip. Resetting is what `freshPc()` used to buy on its own.
    localStorage.clear();
    __resetStore();
    const pc = freshPc();
    seed(pc, ["src/a.js", "src/b.js"]);
    const unsplit = mount(pc);
    fireEvent.contextMenu(screen.getByText("b.js"));
    fireEvent.click(screen.getByText("Split — give it its own side"));
    expect(getTabs(pc).panes.map((p) => p.tabs.map((t) => t.file.path))).toEqual([["src/a.js"], ["src/b.js"]]);
    unsplit.unmount();

    // With a split standing the same verb carries it back, and says so.
    const state = getTabs(pc);
    mount(pc, { tabs: state.panes[1].tabs, pane: 1 });
    fireEvent.contextMenu(screen.getByText("b.js"));
    fireEvent.click(screen.getByText("Move to the other side"));
    const after = getTabs(pc);
    // The right-hand pane emptied, so it is gone — "close all the tabs on one side and it goes
    // back to regular", enforced by the store rather than by this component.
    expect(after.panes).toHaveLength(1);
    expect(after.panes[0].tabs.map((t) => t.file.path)).toEqual(["src/a.js", "src/b.js"]);
  });

  it("pressing a side makes it the side the next document opens on", () => {
    const pc = freshPc();
    const state = split(pc, ["src/a.js", "src/b.js"]);
    expect(getTabs(pc).focus).toBe(1); // the split focuses the new side
    const left = mount(pc, { tabs: state.panes[0].tabs, pane: 0 });
    // A mousedown on the strip's own box, not on a tab: a click on the empty tail still says
    // "I am working over here", which is the difference between opening a document beside what he
    // is reading and opening it on the other screen.
    fireEvent.mouseDown(left.container.querySelector(".doc-tabs"));
    expect(getTabs(pc).focus).toBe(0);
  });
});
