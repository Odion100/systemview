import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useBlockFailure, failureSummary, failureKey, _resetSentFailures } from "./blockFailure";
import { MarkdownScopeProvider, MarkdownMembersProvider } from "./context";
import { sendUpdateTo } from "./docSend";

jest.mock("./docSend", () => ({ sendUpdateTo: jest.fn(async () => ({ ok: true })) }));

// A BLOCK THAT CANNOT RESOLVE WHAT IT POINTS AT MUST TELL THE AGENT THAT WROTE IT.
//
// His catch: a `::commit` carrying a sha from another repo renders "no such commit" and the agent
// never hears, so it stays wrong until he says so. The delivery route already existed — the
// members on a sendUpdate are supplied by the caller and win over the file — which is the thing
// these claims pin, because the first answer I gave him was that no such route existed.

const Probe = ({ kind = "commit", ref: r = "4ce4444", reason = "no such commit" }) => {
  const report = useBlockFailure();
  React.useEffect(() => {
    report({ kind, ref: r, reason });
  }, [report, kind, r, reason]);
  return null;
};

const mount = ({ projectCode = "systemview-test", members = [], docPath = "", chat = "main" } = {}) =>
  render(
    <MemoryRouter><MarkdownScopeProvider value={{ projectCode, chat }}>
      <MarkdownMembersProvider value={{ members, hasMembers: !!members.length, source: "", docPath, projectCode: docPath ? projectCode : "" }}>
        <Probe />
      </MarkdownMembersProvider>
    </MarkdownScopeProvider></MemoryRouter>,
  );

beforeEach(() => {
  _resetSentFailures();
  sendUpdateTo.mockClear();
  sendUpdateTo.mockImplementation(async () => ({ ok: true }));
});

describe("the sentence the agent receives", () => {
  it("leads with the value it has to change", () => {
    expect(failureSummary({ kind: "commit", ref: "4ce4444", reason: "no such commit" })).toBe(
      'a ::commit you wrote points at "4ce4444" and it does not resolve — no such commit',
    );
  });

  it("says where, when the block is not in a document", () => {
    expect(failureSummary({ kind: "file", ref: "a.js", reason: "gone", where: "this chat" })).toContain("in this chat");
  });

  it("still reads when the block carried no ref at all", () => {
    expect(failureSummary({ kind: "test", reason: "the hub answered nothing" })).toBe(
      "a ::test you wrote does not resolve — the hub answered nothing",
    );
  });
});

describe("who hears it", () => {
  // IN THE CHAT the writer is the one agent the room belongs to, and nobody else is told: a broken
  // block is a note to its author, not news.
  it("tells the chat's own agent when there is no document", async () => {
    mount({ projectCode: "systemview-test" });
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    expect(sendUpdateTo.mock.calls[0][0].members).toEqual(["systemview-test"]);
  });

  // THE NOTIFICATION ENDS WITH "read the file rather than trusting this line", so the path has to
  // BE a file. The first version sent `.systemview/chats/<project>` — a folder prefix — and the
  // one piece of advice in the message was a dead instruction, visibly, in his window.
  it("points at the room's real transcript, not a folder prefix", async () => {
    mount({ projectCode: "systemview-test", chat: "main" });
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    expect(sendUpdateTo.mock.calls[0][0].path).toBe(".systemview/chats/systemview-test.main.jsonl");
  });

  // NO REAL ADDRESS, NO SEND. A message whose only instruction leads nowhere spends the reader's
  // trust on a dead lead, which is worse than silence because it looks like one.
  it("sends nothing when it has no file to name", async () => {
    mount({ projectCode: "systemview-test", chat: "" });
    await new Promise((r) => setTimeout(r, 10));
    expect(sendUpdateTo).not.toHaveBeenCalled();
  });

  it("tells a document's members when there is one, because they are who can fix it", async () => {
    mount({ projectCode: "systemview-test", members: ["autobot", "bu"], docPath: "RFCs/RFC-1.md" });
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    expect(sendUpdateTo.mock.calls[0][0].members).toEqual(["autobot", "bu"]);
    expect(sendUpdateTo.mock.calls[0][0].path).toBe("RFCs/RFC-1.md");
  });

  it("tells nobody, and does not throw, where no agent stands behind the surface", async () => {
    mount({ projectCode: "" });
    await new Promise((r) => setTimeout(r, 10));
    expect(sendUpdateTo).not.toHaveBeenCalled();
  });
});

describe("once, and only once", () => {
  // A block re-renders on a scroll, a poll, a sibling's state change. Every render re-reporting is
  // the failure mode that would make this worse than silence.
  it("does not re-send the same failure when the block re-renders", async () => {
    const { rerender } = render(
      <MemoryRouter><MarkdownScopeProvider value={{ projectCode: "systemview-test", chat: "main" }}>
        <MarkdownMembersProvider value={{ members: [], hasMembers: false, source: "", docPath: "", projectCode: "" }}>
          <Probe />
        </MarkdownMembersProvider>
      </MarkdownScopeProvider></MemoryRouter>,
    );
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 5; i += 1) {
      rerender(
        <MemoryRouter><MarkdownScopeProvider value={{ projectCode: "systemview-test", chat: "main" }}>
          <MarkdownMembersProvider value={{ members: [], hasMembers: false, source: "", docPath: "", projectCode: "" }}>
            <Probe />
          </MarkdownMembersProvider>
        </MarkdownScopeProvider></MemoryRouter>,
      );
    }
    await new Promise((r) => setTimeout(r, 10));
    expect(sendUpdateTo).toHaveBeenCalledTimes(1);
  });

  // A REFUSED SEND IS NOT A SENT ONE. Remembering it would make the failure permanently
  // unreportable for the life of the page — the quietest possible outcome for a mechanism whose
  // whole purpose is to stop something being quiet.
  it("retries after a refused send rather than remembering it as told", async () => {
    sendUpdateTo.mockImplementationOnce(async () => ({ ok: false, error: "the host door is not granted here" }));
    const { rerender, unmount } = render(
      <MemoryRouter><MarkdownScopeProvider value={{ projectCode: "systemview-test", chat: "main" }}>
        <MarkdownMembersProvider value={{ members: [], hasMembers: false, source: "", docPath: "", projectCode: "" }}>
          <Probe />
        </MarkdownMembersProvider>
      </MarkdownScopeProvider></MemoryRouter>,
    );
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    unmount();
    render(
      <MemoryRouter><MarkdownScopeProvider value={{ projectCode: "systemview-test", chat: "main" }}>
        <MarkdownMembersProvider value={{ members: [], hasMembers: false, source: "", docPath: "", projectCode: "" }}>
          <Probe />
        </MarkdownMembersProvider>
      </MarkdownScopeProvider></MemoryRouter>,
    );
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(2));
    void rerender;
  });

  it("a different ref is a different failure", () => {
    const a = failureKey({ kind: "commit", ref: "aaa", reason: "no such commit", audience: ["x"] });
    const b = failureKey({ kind: "commit", ref: "bbb", reason: "no such commit", audience: ["x"] });
    expect(a).not.toBe(b);
    expect(a).toBe(failureKey({ kind: "commit", ref: "aaa", reason: "no such commit", audience: ["x"] }));
  });
});

// IT HAS TO SAY WHAT IT IS. Without the flag the harness composes "a document you are a member of
// was updated" and closes with "you are on it because the document says so" — wrong twice for a
// block reporting itself from a chat, where there is no document and the recipient is the author.
// His catch, on the first real one he saw: "why does this say document? It's not coming from the
// document."
it("flags the send as a FAULT, so the headline does not call it a document update", async () => {
  mount({ projectCode: "systemview-test", chat: "main" });
  await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
  expect(sendUpdateTo.mock.calls[0][0].fault).toBe(true);
});
