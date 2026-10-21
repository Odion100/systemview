import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Thread from "./Thread";
import { MarkdownWriteProvider, MarkdownMembersProvider } from "../context";
import ServiceContext from "../../../ServiceContext";

// RFC-071 — A THREAD'S MEMBERSHIP IS MANAGED ON THE THREAD.
//
// It shipped as a caption: the names were visible but every control was in the right-click menu,
// where "add" worked and removing ONE person was impossible — his report, 2026-10-19: *"you can't
// remove one person from the thread… if you add the chip functionality"* — and the row also drew
// the DOCUMENT's members, which he struck out: *"it shouldn't even be showing that from the
// document, that's implicit."*
//
// The second half of that was REVERSED on 2026-10-20, when a bare thread began inheriting the
// document's list — see the claim below, which carries both rulings and why the newer one wins.
//
// These are the claims that keep both from coming back. Mounting is possible because the block
// imports no markdown renderer (react-markdown is ESM and jest will not parse it) — the renderer
// itself still cannot be mounted, which is its own card on the board.

const SERVICES = [{ projectCode: "buapi" }, { projectCode: "systemlynx" }, { projectCode: "systemview" }];

const mount = ({ members, docMembers = [], hasMembers = true, editable = true } = {}) => {
  const setAttr = jest.fn();
  render(
    <ServiceContext.Provider value={{ connectedServices: SERVICES }}>
      <MarkdownWriteProvider value={{ editable, setAttr, appendInside: jest.fn() }}>
        <MarkdownMembersProvider
          value={{ members: docMembers, hasMembers, source: "", docPath: "RFCs/x.md", projectCode: "systemview" }}
        >
          <Thread attrs={{ id: "t1", ...(members === undefined ? {} : { members }) }} line={12} src="" children={null} />
        </MarkdownMembersProvider>
      </MarkdownWriteProvider>
    </ServiceContext.Provider>,
  );
  return { setAttr };
};

describe("the thread's own members", () => {
  it("draws a chip per member of the THREAD", () => {
    mount({ members: "buapi|systemlynx" });
    expect(screen.getByText("buapi")).toBeTruthy();
    expect(screen.getByText("systemlynx")).toBeTruthy();
  });

  // ── THE ONE CLAIM THIS CHANGE REVERSED (2026-10-20) ─────────────────────────────────────────
  // It read "never draws the document's members as the thread's", for his 2026-10-19 ruling:
  // *"it shouldn't even be showing that from the document, that's implicit. It should only show if
  // there's members on the thread."* That was aimed at a dimmed, uncontrollable "from the document"
  // ROW, and it held while inheritance was only a delivery rule nobody could touch.
  //
  // It cannot hold now. His 2026-10-20 ruling makes a bare thread inherit the document's list —
  // *"I have to individually attach you to each thread, even though you're a member on the entire
  // document"* — WITH the removal that makes it safe: *"I still have the ability to delete them if
  // I wanted to make it different."* A × needs a chip to press. So the document's people are drawn
  // as what they now are, this thread's members, and marked inherited because × on them narrows the
  // thread rather than editing a list. The old row is still gone: there is no second row and no
  // "from the document" caption, which is what he was actually objecting to.
  it("draws the document's people on a thread that names none — the chore this removes", () => {
    mount({ docMembers: ["buapi", "systemlynx"] });
    expect(screen.getByText("buapi")).toBeTruthy();
    expect(screen.getByText("systemlynx")).toBeTruthy();
    expect(screen.queryByText("from the document")).toBeNull();
    expect(screen.queryByText("nobody on this thread yet")).toBeNull();
  });

  it("marks an inherited chip, because × on one does something different", () => {
    mount({ docMembers: ["buapi"] });
    expect(screen.getByTitle(/buapi is on this document, so they are in this thread/)).toBeTruthy();
    expect(screen.getByTitle("narrow this thread to everybody but buapi")).toBeTruthy();
  });

  // NARROWING, FROM THE OTHER SIDE: a thread that names people inherits nothing, so the document's
  // other members are not in this conversation and are not drawn in it.
  it("a thread that names somebody shows only them, document or no document", () => {
    mount({ members: "buapi", docMembers: ["buapi", "systemlynx"] });
    expect(screen.getByText("buapi")).toBeTruthy();
    expect(screen.queryByText("systemlynx")).toBeNull();
  });

  it("says nobody only when there is nobody — no document members and none of its own", () => {
    mount({ docMembers: [] });
    expect(screen.getByText("nobody on this thread yet")).toBeTruthy();
  });

  // THE PRESS THAT HAS NOTHING TO REMOVE FROM, and the one a future change is most likely to break.
  // An inherited thread has no `members=` to edit, so × MATERIALISES the narrowed list: everyone
  // inherited, minus the one dropped, written onto this thread's own opener. From that write on the
  // thread carries an explicit list and inherits nothing — the narrowing rule doing the work.
  it("× on an inherited chip writes the narrowed list onto the thread's own line", () => {
    const { setAttr } = mount({ docMembers: ["buapi", "systemlynx"] });
    fireEvent.click(screen.getByTitle("narrow this thread to everybody but buapi"));
    expect(setAttr).toHaveBeenCalledWith(12, "members", "systemlynx");
  });

  // AND IT MUST NOT LOOK BROKEN: clearing the attribute would hand the document's people back on
  // the next render — press ×, they reappear. An emptied list is written as `members=""`, which is
  // present and names nobody.
  it("× on the LAST inherited chip means nobody, not inheriting all over again", () => {
    const { setAttr } = mount({ docMembers: ["buapi"] });
    fireEvent.click(screen.getByTitle("narrow this thread to everybody but buapi"));
    expect(setAttr).toHaveBeenCalledWith(12, "members", "");
  });

  // …and adding to an inheriting thread materialises it the same way, through the same write: the
  // people it already had, plus the new one, so the + cannot silently drop the inherited list.
  it("adding to an inheriting thread keeps the people it inherited", () => {
    const { setAttr } = mount({ docMembers: ["buapi"] });
    fireEvent.click(screen.getByTitle("add a member to this thread"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "systemlynx" } });
    expect(setAttr).toHaveBeenCalledWith(12, "members", "buapi|systemlynx");
  });

  // "If there's already a member's block in the document" — that is what the row hangs on, so an
  // empty thread still has a + to start its list with.
  it("offers the row on a document that has a members block, and nothing on one that does not", () => {
    mount({ hasMembers: true });
    expect(screen.getByTitle("add a member to this thread")).toBeTruthy();
  });

  it("says nothing about membership when the document has no members block", () => {
    mount({ hasMembers: false });
    expect(screen.queryByTitle("add a member to this thread")).toBeNull();
    expect(screen.queryByText("in this thread")).toBeNull();
  });

  it("adding writes the thread's OWN attribute, on the thread's own line", () => {
    const { setAttr } = mount({ members: "buapi" });
    fireEvent.click(screen.getByTitle("add a member to this thread"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "systemlynx" } });
    expect(setAttr).toHaveBeenCalledWith(12, "members", "buapi|systemlynx");
  });

  // The whole complaint: one person off the thread, not the list wiped.
  it("removes ONE member and leaves the rest", () => {
    const { setAttr } = mount({ members: "buapi|systemlynx" });
    fireEvent.click(screen.getByTitle("take buapi out of this thread"));
    expect(setAttr).toHaveBeenCalledWith(12, "members", "systemlynx");
  });

  // Dropping the last chip clears the attribute — which is also what the right-click clear-all did,
  // so removing that menu item lost nothing.
  it("dropping the last member clears the attribute, back to the document's people", () => {
    const { setAttr } = mount({ members: "buapi" });
    fireEvent.click(screen.getByTitle("take buapi out of this thread"));
    expect(setAttr).toHaveBeenCalledWith(12, "members", null);
  });

  it("only offers connected projects, and never one already on this thread", () => {
    mount({ members: "buapi" });
    fireEvent.click(screen.getByTitle("add a member to this thread"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("systemlynx");
    expect(options).not.toContain("buapi");
  });

  // A read-only surface renders the names and offers no press — the same rule :::approval follows.
  it("a read-only surface shows the thread's members and no controls", () => {
    const { setAttr } = mount({ members: "buapi", editable: false });
    expect(screen.getByText("buapi")).toBeTruthy();
    expect(screen.queryByTitle("take buapi out of this thread")).toBeNull();
    expect(screen.queryByTitle("add a member to this thread")).toBeNull();
    expect(setAttr).not.toHaveBeenCalled();
  });
});

// RFC-071, his 2026-10-19 — *"let's get dirty."* A reply used to announce itself to the thread's
// members on the spot. Now it makes them BEHIND: auto members are told when it settles, and anyone
// else is a chip in the pinned row at the top of the document, under this thread's own pill. That
// is what lets a member be on both levels and hear about only one.
describe("a reply makes the thread dirty rather than announcing itself", () => {
  const mountThread = ({ members = "buapi", bridge = jest.fn(async () => ({ ok: true })) } = {}) => {
    const setAttr = jest.fn();
    global.window.systemview = { documents: { sendUpdate: bridge } };
    render(
      <ServiceContext.Provider value={{ connectedServices: SERVICES }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr, appendInside: jest.fn() }}>
          <MarkdownMembersProvider
            value={{ members: [], hasMembers: true, source: "", docPath: "x.md", projectCode: "p" }}
          >
            <Thread attrs={{ id: "t1", members }} line={12} src="talk" children={null} />
          </MarkdownMembersProvider>
        </MarkdownWriteProvider>
      </ServiceContext.Provider>,
    );
    return { setAttr, bridge };
  };

  afterEach(() => {
    delete global.window.systemview;
  });

  it("posting announces nothing from here", () => {
    const { bridge } = mountThread();
    fireEvent.click(screen.getByTitle("Reply on this"));
    fireEvent.change(screen.getByPlaceholderText("reply on this…"), { target: { value: "dirty" } });
    fireEvent.click(screen.getByText("Post"));
    expect(bridge).not.toHaveBeenCalled();
  });

  // The gear is the only control beside a membership now — one per level, two different auto lists.
  it("carries its own settings gear, for this conversation's auto list", () => {
    mountThread();
    expect(screen.getByTitle("who hears about thread t1 automatically")).toBeTruthy();
  });

  it("writes auto onto the THREAD's line, not the document's", () => {
    const { setAttr } = mountThread();
    fireEvent.click(screen.getByTitle("who hears about thread t1 automatically"));
    fireEvent.click(screen.getByTitle(/tell buapi automatically/));
    expect(setAttr).toHaveBeenCalledWith(12, "auto", "buapi");
  });
});
