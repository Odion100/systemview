import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MembersPin from "./MembersPin";
import { MarkdownWriteProvider, MarkdownMembersProvider } from "../context";
import { hashOf, membersBlockOf, threadBlocksOf } from "../docMembers";

// RFC-071 — THE UPDATE ROW THAT DOES NOT SCROLL AWAY. His: *"I shouldn't have to scroll back up to
// where I added them as a member to send them an update. They're supposed to be on the top right
// corner regardless."*
//
// The claims that matter are about what it is NOT: not a second membership (it reads the document's
// own `::members` line), not a surface that pretends to save (read-only renders nothing), and not a
// row that lingers once everybody has been told.

const SRC = "# A plan\n\n::members{who=buapi|systemlynx}\n\nbody\n";

const mount = ({ src = SRC, editable = true, bridge = jest.fn(async () => ({ ok: true })) } = {}) => {
  const setAttr = jest.fn();
  global.window.systemview = { documents: { sendUpdate: bridge } };
  render(
    <MarkdownWriteProvider value={{ editable, setAttr }}>
      <MarkdownMembersProvider
        value={{
          block: membersBlockOf(src),
          threads: threadBlocksOf(src),
          source: src,
          docPath: "RFCs/x.md",
          projectCode: "systemview",
        }}
      >
        <MembersPin />
      </MarkdownMembersProvider>
    </MarkdownWriteProvider>,
  );
  return { setAttr, bridge };
};

afterEach(() => {
  delete global.window.systemview;
});

describe("the pinned update row", () => {
  it("names everybody who has not heard about this version", () => {
    mount();
    expect(screen.getByText("document")).toBeTruthy();
    expect(screen.getByTitle("tell buapi about this version of the document")).toBeTruthy();
    expect(screen.getByTitle("tell systemlynx about this version of the document")).toBeTruthy();
  });

  // The row IS the state — it goes away rather than claiming anything.
  it("draws nothing once everybody has been told about this version", () => {
    // The hash deliberately IGNORES the members line, so stamping it cannot make the document dirty
    // again — which is why one hash of SRC is the right stamp for the stamped version too.
    const stamp = hashOf(SRC);
    const stamped = SRC.replace("}", ` sent=buapi:${stamp}|systemlynx:${stamp}}`);
    const { container } = render(
      <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
        <MarkdownMembersProvider
          value={{ block: membersBlockOf(stamped), source: stamped, docPath: "x.md", projectCode: "p" }}
        >
          <MembersPin />
        </MarkdownMembersProvider>
      </MarkdownWriteProvider>,
    );
    expect(container.textContent).toBe("");
  });

  it("draws nothing on a document with no members line", () => {
    const { container } = render(
      <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
        <MarkdownMembersProvider value={{ block: null, source: "# plain\n", docPath: "x.md", projectCode: "p" }}>
          <MembersPin />
        </MarkdownMembersProvider>
      </MarkdownWriteProvider>,
    );
    expect(container.textContent).toBe("");
  });

  // A read-only surface has no file to stamp, so an update row there would be a press that lies.
  it("draws nothing where the surface cannot save", () => {
    mount({ editable: false });
    expect(screen.queryByText("document")).toBeNull();
  });

  it("a chip press tells that one member and stamps the document's members line", async () => {
    const { setAttr, bridge } = mount();
    fireEvent.click(screen.getByTitle("tell buapi about this version of the document"));
    await screen.findByTitle("tell systemlynx about this version of the document");
    expect(bridge).toHaveBeenCalledTimes(1);
    const payload = bridge.mock.calls[0][0];
    expect(payload.members).toEqual(["buapi"]);
    expect(payload.path).toBe("RFCs/x.md");
    // The stamp goes on line 3 — the `::members` line — never on whatever the row is floating over.
    expect(setAttr).toHaveBeenCalledWith(3, "sent", `buapi:${hashOf(SRC)}`);
  });

  it("the all press tells everybody who is behind, in one event", async () => {
    const { bridge } = mount();
    fireEvent.click(screen.getByText("all 2"));
    await screen.findByText("document");
    expect(bridge.mock.calls[0][0].members).toEqual(["buapi", "systemlynx"]);
  });

  // The sticky pair: a sentinel above the row says whether the document is scrolled, because CSS
  // alone cannot tell at-rest from pinned when the row is the first thing in the scroller. jsdom

  it("says a refusal where the press was rather than swallowing it", async () => {
    mount({ bridge: jest.fn(async () => ({ ok: false, error: "no members on this document" })) });
    fireEvent.click(screen.getByTitle("tell buapi about this version of the document"));
    expect(await screen.findByText("no members on this document")).toBeTruthy();
  });
});

// ── BOTH LEVELS, AS SEPARATE PILLS (his, 2026-10-19) ──────────────────────────────────────────
// *"the update sending the update via a thread level and on a document level should probably be
// separate blocks up there… I might have you subscribed on multiple levels, but only want to send
// you the thread update."*
describe("thread updates ride in the same corner, in their own pill", () => {
  const WITH_THREAD = [
    "# A plan",
    "",
    `::members{who=systemlynx sent=systemlynx:HASH}`,
    "",
    "::::thread{id=t1 members=buapi}",
    "the argument",
    ":::reply{author=you ts=2}",
    "Let's get dirty.",
    ":::",
    "::::",
    "",
  ].join("\n");
  // BUAPI WAS BROUGHT IN FOR ONE CONVERSATION — on the thread, on no document line — so nothing
  // about the document can ever cover them, and the corner must show one pill, the thread's.
  //
  // This fixture used to put buapi on BOTH levels with the document current, and read that as the
  // thread still being behind. His rule of 2026-10-20 retired that reading: the document's hash is
  // the whole source, so a member current on the document has been told about the threads too, and
  // a pill claiming otherwise would be the surface lying about a subscription. The claims below are
  // about the two levels RENDERING distinctly and a press staying surgical, which is what they were
  // always worth — so they keep their intent on a fixture the rule allows.
  const src = WITH_THREAD.replace("HASH", hashOf(WITH_THREAD));

  const mountBoth = (bridge = jest.fn(async () => ({ ok: true }))) => {
    const setAttr = jest.fn();
    global.window.systemview = { documents: { sendUpdate: bridge } };
    render(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <MarkdownMembersProvider
          value={{
            block: membersBlockOf(src),
            threads: threadBlocksOf(src),
            source: src,
            docPath: "RFCs/x.md",
            projectCode: "systemview",
          }}
        >
          <MembersPin />
        </MarkdownMembersProvider>
      </MarkdownWriteProvider>,
    );
    return { setAttr, bridge };
  };

  it("names the thread rather than lumping it in with the document", () => {
    mountBoth();
    expect(screen.getByText("💬 t1")).toBeTruthy();
    expect(screen.queryByText("document")).toBeNull();
    expect(screen.getByTitle("tell buapi about this version of thread t1")).toBeTruthy();
  });

  it("the two levels are separate pills, so one press can never mean the other", () => {
    const { container } = (() => {
      mountBoth();
      return { container: document.body };
    })();
    expect(container.querySelectorAll(".md-members-pin__row--thread").length).toBe(1);
    expect(container.querySelectorAll(".md-members-pin__row--document").length).toBe(0);
  });

  // THE WHOLE POINT OF THE SPLIT: the event says which thread, and the stamp lands on the THREAD's
  // line — the document's members line is untouched, so he stays behind on the document.
  it("tells the thread only, and stamps the thread's own line", async () => {
    const { setAttr, bridge } = mountBoth();
    fireEvent.click(screen.getByTitle("tell buapi about this version of thread t1"));
    // The pill leaves the corner once its one member has been told — that IS the confirmation.
    await waitFor(() => expect(screen.queryByText("💬 t1")).toBeNull());
    const payload = bridge.mock.calls[0][0];
    expect(payload.thread).toBe("t1");
    expect(payload.members).toEqual(["buapi"]);
    expect(payload.summary).toContain("Let's get dirty.");
    // Line 5 is the thread's opener; line 3 is the document's members line.
    expect(setAttr).toHaveBeenCalledWith(5, "sent", `buapi:${hashOf(threadBlocksOf(src)[0].body)}`);
    expect(setAttr).not.toHaveBeenCalledWith(3, "sent", expect.anything());
  });
});

// THE PILL IS A DOOR (his, 2026-10-19): pressing the label — or anywhere in the pill that is not an
// agent's chip — goes to the thread it is about. Pressing a chip still sends, and only sends.
describe("the pill takes you to what it is about", () => {
  const SRC = ["# A plan", "", "::members{who=buapi}", "", "::::thread{id=t3 members=buapi}", "talk", "::::"].join("\n");

  const mountIn = () => {
    const setAttr = jest.fn();
    global.window.systemview = { documents: { sendUpdate: jest.fn(async () => ({ ok: true })) } };
    // The thread's block, as the renderer draws it — the line is the address the pill already has.
    const block = document.createElement("div");
    block.className = "md-block";
    block.setAttribute("data-md-name", "thread");
    block.setAttribute("data-md-start", "5");
    block.scrollIntoView = jest.fn();
    document.body.appendChild(block);
    render(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <MarkdownMembersProvider
          value={{
            block: membersBlockOf(SRC),
            threads: threadBlocksOf(SRC),
            source: SRC,
            docPath: "RFCs/x.md",
            projectCode: "systemview",
          }}
        >
          <MembersPin />
        </MarkdownMembersProvider>
      </MarkdownWriteProvider>,
    );
    return { block, setAttr };
  };

  afterEach(() => {
    document.querySelectorAll(".md-block").forEach((n) => n.remove());
  });

  it("pressing the label scrolls the thread into view", () => {
    const { block } = mountIn();
    fireEvent.click(screen.getByText("💬 t3"));
    expect(block.scrollIntoView).toHaveBeenCalled();
  });

  it("pressing an agent's chip sends and does NOT navigate", () => {
    const { block } = mountIn();
    fireEvent.click(screen.getByTitle("tell buapi about this version of thread t3"));
    expect(block.scrollIntoView).not.toHaveBeenCalled();
    expect(window.systemview.documents.sendUpdate).toHaveBeenCalled();
  });
});

// HIS, 2026-10-19: *"it could get in the way… you should be able to tuck this away"* — and then the
// bug that followed: *"every time a document updates it reopens. If I refresh the page, it doesn't
// keep the state."* It was never persisted, and it re-opened itself on every change. Staying tucked
// hides nothing: the collapsed tab is on screen carrying the count, and an empty corner only ever
// means nobody is behind.
describe("tucking the stack to the edge", () => {
  const SRC = ["# A plan", "", "::members{who=buapi}", "", "body"].join("\n");

  const mountOne = (src = SRC, docPath = "x.md") => {
    global.window.systemview = { documents: { sendUpdate: jest.fn(async () => ({ ok: true })) } };
    return render(
      <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
        <MarkdownMembersProvider
          value={{ block: membersBlockOf(src), threads: [], source: src, docPath, projectCode: "p" }}
        >
          <MembersPin />
        </MarkdownMembersProvider>
      </MarkdownWriteProvider>,
    );
  };

  beforeEach(() => window.localStorage.clear());

  it("tucks the WHOLE stack, leaving the tab a collapsed panel leaves", () => {
    mountOne();
    fireEvent.click(screen.getByTitle("tuck these to the edge"));
    expect(screen.getByText("‹ 1 update")).toBeTruthy();
    fireEvent.click(screen.getByText("‹ 1 update"));
    expect(screen.getByText("document")).toBeTruthy();
  });

  // THE BUG: a change used to pop it back open.
  it("stays tucked when the document changes", () => {
    const { rerender } = mountOne();
    fireEvent.click(screen.getByTitle("tuck these to the edge"));
    const moved = `${SRC}\nand another line\n`;
    rerender(
      <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
        <MarkdownMembersProvider
          value={{ block: membersBlockOf(moved), threads: [], source: moved, docPath: "x.md", projectCode: "p" }}
        >
          <MembersPin />
        </MarkdownMembersProvider>
      </MarkdownWriteProvider>,
    );
    expect(screen.queryByText("document")).toBeNull();
    expect(screen.getByText("‹ 1 update")).toBeTruthy();
  });

  // AND THE OTHER HALF: a reload used to lose it.
  it("remembers across a remount, per document", () => {
    const first = mountOne();
    fireEvent.click(screen.getByTitle("tuck these to the edge"));
    first.unmount();
    mountOne();
    expect(screen.getByText("‹ 1 update")).toBeTruthy();
    expect(screen.queryByText("document")).toBeNull();
    // Another document is another corner — tucking one must not tuck them all.
    first.unmount && null;
    mountOne(SRC, "other.md");
    expect(screen.getAllByText("document").length).toBe(1);
  });

  it("draws nothing at all when nobody is behind — tucked or not", () => {
    const stamp = hashOf(SRC);
    const stamped = SRC.replace("who=buapi", `who=buapi sent=buapi:${stamp}`);
    const { container } = mountOne(stamped);
    expect(container.textContent).toBe("");
  });
});
