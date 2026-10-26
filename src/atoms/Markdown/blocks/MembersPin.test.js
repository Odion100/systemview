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
    expect(screen.getByText("all threads")).toBeTruthy();
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
    expect(screen.queryByText("all threads")).toBeNull();
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
    await screen.findByText("all threads");
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
    expect(screen.queryByText("all threads")).toBeNull();
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
    // THE REAL GEOMETRY: the pin and the document's blocks share ONE `.markdown` root, and the
    // reveal searches from the pin's own root — never the page. The page-wide search was the bug
    // (his catch, 2026-10-26): the CHAT's karaoke stamps carry the same `data-md-start`, so
    // clicking a pill scrolled the chat instead of the document.
    const root = document.createElement("div");
    root.className = "markdown";
    document.body.appendChild(root);
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
      { container: root },
    );
    // The thread's block, as the renderer draws it — appended after the render so React does not
    // sweep it, inside the same root the pin searches.
    const block = document.createElement("div");
    block.className = "md-block";
    block.setAttribute("data-md-name", "thread");
    block.setAttribute("data-md-start", "5");
    block.scrollIntoView = jest.fn();
    root.appendChild(block);
    // …and an IMPOSTOR with the same line OUTSIDE the root — the chat's karaoke stamp. The reveal
    // must never reach it.
    const impostor = document.createElement("div");
    impostor.setAttribute("data-md-start", "5");
    impostor.scrollIntoView = jest.fn();
    document.body.insertBefore(impostor, root);
    return { block, impostor, setAttr };
  };

  afterEach(() => {
    document.querySelectorAll(".md-block").forEach((n) => n.remove());
  });

  it("pressing the label scrolls the thread into view — in THIS pane, never the chat's twin", () => {
    const { block, impostor } = mountIn();
    fireEvent.click(screen.getByText("💬 t3"));
    expect(block.scrollIntoView).toHaveBeenCalled();
    // The impostor sits EARLIER in the DOM with the same line — the old page-wide querySelector
    // would have found it first and scrolled the wrong surface.
    expect(impostor.scrollIntoView).not.toHaveBeenCalled();
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

  // THE TAB IS JUST THE COUNT. Set vertically and spelling out "‹ 1 update", it ran down the right
  // edge and straight through the arc block's title — *"the tab blocks part of the arc title."* So
  // the label is the number and the sentence lives in the tooltip, which is why this is found by
  // its TITLE and the wording asserted separately: a test keyed to the visible words has to be
  // rewritten every time the label gets smaller, and would not notice the meaning going missing.
  const tab = () => screen.getByTitle(/waiting to be told/);

  it("says the whole thing in its tooltip while showing only the count", () => {
    mountOne();
    fireEvent.click(screen.getByTitle("tuck these to the edge"));
    expect(tab().getAttribute("title")).toBe("1 waiting to be told — bring them back");
    expect(tab().textContent.replace(/\s+/g, " ").trim()).toBe("‹ 1");
  });

  it("tucks the WHOLE stack, leaving the tab a collapsed panel leaves", () => {
    mountOne();
    fireEvent.click(screen.getByTitle("tuck these to the edge"));
    expect(tab()).toBeTruthy();
    fireEvent.click(tab());
    expect(screen.getByText("all threads")).toBeTruthy();
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
    expect(screen.queryByText("all threads")).toBeNull();
    expect(tab()).toBeTruthy();
  });

  // AND THE OTHER HALF: a reload used to lose it.
  it("remembers across a remount, per document", () => {
    const first = mountOne();
    fireEvent.click(screen.getByTitle("tuck these to the edge"));
    first.unmount();
    mountOne();
    expect(tab()).toBeTruthy();
    expect(screen.queryByText("all threads")).toBeNull();
    // Another document is another corner — tucking one must not tuck them all.
    first.unmount && null;
    mountOne(SRC, "other.md");
    expect(screen.getAllByText("all threads").length).toBe(1);
  });

  it("draws nothing at all when nobody is behind — tucked or not", () => {
    const stamp = hashOf(SRC);
    const stamped = SRC.replace("who=buapi", `who=buapi sent=buapi:${stamp}`);
    const { container } = mountOne(stamped);
    expect(container.textContent).toBe("");
  });
});

// CAUGHT UP WITHOUT BEING TOLD. There was a press to SEND an update and none to CLEAR one — and
// "behind" is derived from a hash, so every save makes everybody behind again. On a document a group
// is editing together the count climbs on their own collaboration: *"I'm not sending you guys every
// little update."*
describe("caught up", () => {
  it("stamps this version for everybody behind", () => {
    const { setAttr } = mount();
    fireEvent.click(screen.getByTitle("they are caught up — stamp this version and tell nobody"));
    const [line, attr, value] = setAttr.mock.calls[0];
    expect(line).toBe(3); // the ::members line
    expect(attr).toBe("sent");
    const stamp = hashOf(SRC);
    expect(value).toBe(`buapi:${stamp}|systemlynx:${stamp}`);
  });

  it("TELLS NOBODY — that is the whole difference from the send", () => {
    const { bridge } = mount();
    fireEvent.click(screen.getByTitle("they are caught up — stamp this version and tell nobody"));
    expect(bridge).not.toHaveBeenCalled();
  });

  it("the row goes once nobody is behind, exactly as it does after a send", async () => {
    mount();
    fireEvent.click(screen.getByTitle("they are caught up — stamp this version and tell nobody"));
    await waitFor(() => expect(screen.queryByText("all threads")).toBeNull());
  });

  it("leaves the same record a send leaves, so a later change is behind again for them", () => {
    const { setAttr } = mount();
    fireEvent.click(screen.getByTitle("they are caught up — stamp this version and tell nobody"));
    const value = setAttr.mock.calls[0][2];
    // the stamp is of THIS version — a hash of a different body would not match it
    expect(value).not.toContain(hashOf(`${SRC}more\n`));
  });
});
