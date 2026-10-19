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

  // The row he told me to stop rendering. Inheritance is real for delivery and silent on screen.
  it("never draws the document's members as the thread's", () => {
    mount({ docMembers: ["buapi", "systemlynx"] });
    expect(screen.queryByText("buapi")).toBeNull();
    expect(screen.queryByText("from the document")).toBeNull();
    expect(screen.getByText("nobody on this thread yet")).toBeTruthy();
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
