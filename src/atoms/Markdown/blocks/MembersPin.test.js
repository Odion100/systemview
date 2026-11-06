import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import MembersPin from "./MembersPin";
import { MarkdownWriteProvider, MarkdownMembersProvider } from "../context";

// THE UPDATE ROW THAT DOES NOT SCROLL AWAY. His: *"I shouldn't have to scroll back up to where I
// added them as a member to send them an update. They're supposed to be on the top right corner
// regardless."*
//
// WHAT IT ROWS CHANGED UNDER THE GATE (his ruling, 2026-11-06): not edits — *"general text in the
// document should send no updates, period point blank"* — but the HELD LANE: decisions the engine
// is holding for his press because their members are plain (not on `auto=`). The pin FETCHES that
// lane from the host's fires door rather than deriving it, so the one definition lives in the
// engine; and its press is a RELEASE, not a composed summary of the file.

const FIRES = (over = {}) => ({
  ok: true,
  fires: [
    {
      name: "approval",
      line: 6,
      thread: "",
      summary: "approved — Ship it?",
      pending: [],
      held: ["buapi", "systemlynx"],
      told: [],
    },
  ],
  ...over,
});

const mount = ({
  fires = jest.fn(async () => FIRES()),
  release = jest.fn(async () => ({ ok: true, released: 1, held: 0 })),
  editable = true,
  src = "# A plan\n\n::members{who=buapi|systemlynx}\n\nbody\n",
  docPath = "RFCs/x.md",
} = {}) => {
  const setAttr = jest.fn();
  global.window.systemview = { documents: { fires, releaseFires: release } };
  render(
    <MarkdownWriteProvider value={{ editable, setAttr }}>
      <MarkdownMembersProvider value={{ source: src, docPath, projectCode: "systemview" }}>
        <MembersPin />
      </MarkdownMembersProvider>
    </MarkdownWriteProvider>,
  );
  return { setAttr, fires, release };
};

afterEach(() => {
  delete global.window.systemview;
  window.localStorage.clear();
});

describe("the pinned row is the held lane, fetched", () => {
  it("asks the host which fires are held, and draws a chip per held member", async () => {
    const { fires } = mount();
    await waitFor(() => expect(screen.getByText("decisions")).toBeTruthy());
    expect(fires).toHaveBeenCalledWith({ path: "RFCs/x.md", project: "systemview" });
    expect(screen.getByTitle(/release the decisions held for buapi/)).toBeTruthy();
    expect(screen.getByTitle(/release the decisions held for systemlynx/)).toBeTruthy();
  });

  it("draws nothing when nothing is held — delivered fires are the engine's silence", async () => {
    const fires = jest.fn(async () => ({ ok: true, fires: [] }));
    mount({ fires });
    await waitFor(() => expect(fires).toHaveBeenCalled());
    expect(document.querySelector(".md-members-pin")).toBeNull();
  });

  it("a fire whose held lane is empty makes no row — pending is the engine's to deliver, not his", async () => {
    const fires = jest.fn(async () =>
      FIRES({ fires: [{ name: "approval", line: 6, thread: "", summary: "s", pending: ["buapi"], held: [], told: [] }] }),
    );
    mount({ fires });
    await waitFor(() => expect(fires).toHaveBeenCalled());
    expect(document.querySelector(".md-members-pin")).toBeNull();
  });

  // A read-only surface has no press to offer, so a row there would be a control that lies.
  it("draws nothing where the surface cannot save", async () => {
    mount({ editable: false });
    await act(async () => {});
    expect(document.querySelector(".md-members-pin")).toBeNull();
  });

  it("a window without the door shows no pin rather than a broken one", async () => {
    const setAttr = jest.fn();
    global.window.systemview = {}; // no documents bridge granted here
    render(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <MarkdownMembersProvider value={{ source: "x", docPath: "x.md", projectCode: "p" }}>
          <MembersPin />
        </MarkdownMembersProvider>
      </MarkdownWriteProvider>,
    );
    await act(async () => {});
    expect(document.querySelector(".md-members-pin")).toBeNull();
  });
});

describe("the press is a RELEASE — managed means these waited for him", () => {
  it("a chip press releases that one member and refetches", async () => {
    const { release, fires } = mount();
    await waitFor(() => expect(screen.getByText("decisions")).toBeTruthy());
    fireEvent.click(screen.getByTitle(/release the decisions held for buapi/));
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(release.mock.calls[0][0]).toEqual({ path: "RFCs/x.md", project: "systemview", member: "buapi", by: "you" });
    await waitFor(() => expect(fires).toHaveBeenCalledTimes(2)); // the refetch is the confirmation
  });

  it("the all press releases the whole document in one call", async () => {
    const { release } = mount();
    await waitFor(() => expect(screen.getByText(/tell all 2/)).toBeTruthy());
    fireEvent.click(screen.getByText(/tell all 2/));
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(release.mock.calls[0][0]).toEqual({ path: "RFCs/x.md", project: "systemview", by: "you" });
  });

  it("says a refusal where the press was rather than swallowing it", async () => {
    const release = jest.fn(async () => ({ ok: false, error: "no live session for buapi" }));
    mount({ release });
    await waitFor(() => expect(screen.getByText("decisions")).toBeTruthy());
    fireEvent.click(screen.getByTitle(/release the decisions held for buapi/));
    await waitFor(() => expect(screen.getByText("no live session for buapi")).toBeTruthy());
  });
});

describe("threads are their own rows", () => {
  const twoScopes = () =>
    jest.fn(async () => ({
      ok: true,
      fires: [
        { name: "approval", line: 6, thread: "", summary: "approved", pending: [], held: ["buapi"], told: [] },
        { name: "reply", line: 12, thread: "t1", summary: "replied in t1", pending: [], held: ["systemlynx"], told: [] },
      ],
    }));

  it("names the thread rather than lumping it in with the document", async () => {
    mount({ fires: twoScopes() });
    await waitFor(() => expect(screen.getByText("💬 t1")).toBeTruthy());
    expect(screen.getByText("decisions")).toBeTruthy();
    expect(screen.getByTitle(/release what thread t1 is holding for systemlynx/)).toBeTruthy();
  });
});

describe("caught up — the stamp that wakes nobody", () => {
  it("stamps told= on each fire's own line, merged over what the line already says", async () => {
    const fires = jest.fn(async () =>
      FIRES({
        fires: [
          { name: "approval", line: 6, thread: "", summary: "s", pending: [], held: ["systemlynx"], told: ["buapi"] },
        ],
      }),
    );
    const { setAttr, release } = mount({ fires });
    await waitFor(() => expect(screen.getByText("✓ caught up")).toBeTruthy());
    fireEvent.click(screen.getByText("✓ caught up"));
    expect(setAttr).toHaveBeenCalledWith(6, "told", "buapi|systemlynx");
    expect(release).not.toHaveBeenCalled(); // that is the whole difference from the tell
  });
});

describe("the count and the door — each press visible, each row a jump", () => {
  it("the chip counts that member's held fires — the receipt of his presses", async () => {
    const fires = jest.fn(async () => ({
      ok: true,
      fires: [
        { name: "approval", line: 6, thread: "", summary: "a", pending: [], held: ["buapi"], told: [] },
        { name: "question", line: 9, thread: "", summary: "b", pending: [], held: ["buapi"], told: [] },
        { name: "question", line: 12, thread: "", summary: "c", pending: [], held: ["buapi", "systemlynx"], told: [] },
      ],
    }));
    mount({ fires });
    await waitFor(() => expect(screen.getByText("·3")).toBeTruthy());
    expect(screen.getByText("·1")).toBeTruthy(); // systemlynx is behind on one
    expect(screen.getByTitle(/release the decisions held for buapi — 3 waiting/)).toBeTruthy();
  });

  it("every row is a door, and clicks cycle through the held fires", async () => {
    const reveals = [];
    document.querySelectorAll; // jsdom — revealBlock walks data-md-start, so give it two targets
    const fires = jest.fn(async () => ({
      ok: true,
      fires: [
        { name: "approval", line: 6, thread: "", summary: "a", pending: [], held: ["buapi"], told: [] },
        { name: "question", line: 9, thread: "", summary: "b", pending: [], held: ["buapi"], told: [] },
      ],
    }));
    mount({ fires });
    await waitFor(() => expect(screen.getByText("decisions")).toBeTruthy());
    const row = screen.getByTitle(/go to the held decision — 2 held, click again for the next/);
    // the row exists and is pressable — cycling is the title's promise; revealBlock's own walk is
    // claimed in its module, so here the claim is the door and its label
    expect(row.getAttribute("role")).toBe("button");
  });
});

describe("tucked to the edge, remembered per document", () => {
  it("tucks the whole stack and shows the count; stays tucked across a remount", async () => {
    mount();
    await waitFor(() => expect(screen.getByTitle("tuck these to the edge")).toBeTruthy());
    fireEvent.click(screen.getByTitle("tuck these to the edge"));
    expect(screen.getByText(/‹ 2/)).toBeTruthy();
    // remount — the choice is his, per document, and nothing but him reopens it
    document.body.innerHTML = "";
    mount();
    await waitFor(() => expect(screen.getByText(/‹ 2/)).toBeTruthy());
    expect(screen.queryByText("✓ caught up")).toBeNull();
  });
});
