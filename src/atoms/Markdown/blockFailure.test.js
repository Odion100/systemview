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

// A RELOAD MUST NOT RE-REPORT. The dedupe was a module Set, so it died with the page and every
// refresh re-sent every broken block still on screen — his catch, after being woken for the same
// two blocks over and over: "all I do is refresh the page and you get that." A reload is the
// commonest thing that happens to a window, which made the in-memory version worse than none: it
// looked solved while flooding on the one event nobody counts.
describe("being told survives the page", () => {
  // A RELOAD MUST NOT RE-REPORT. The dedupe was a module Set, so it died with the page and every
  // refresh re-sent every broken block still on screen — his catch, after being woken for the
  // same two blocks over and over: "all I do is refresh the page and you get that." A reload is
  // the commonest thing that happens to a window, which made the in-memory version worse than
  // none: it looked solved while flooding on the one event nobody counts.
  //
  // Checked at the STORAGE seam rather than by simulating a reload: a jest module reset is not a
  // page load, and a claim that pretends otherwise is the kind of proof that let this ship.
  it("writes the failure into storage, so a fresh page already knows", async () => {
    mount({ projectCode: "systemview-test", chat: "main" });
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    const saved = JSON.parse(window.localStorage.getItem("sv.blockFault.sent") || "{}");
    expect(Object.keys(saved).length).toBe(1);
    expect(Object.keys(saved)[0]).toContain("4ce4444");
  });

  it("reports again when the same block fails for a different reason", async () => {
    mount({ projectCode: "systemview-test", chat: "main" });
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    sendUpdateTo.mockClear();
    render(
      <MemoryRouter><MarkdownScopeProvider value={{ projectCode: "systemview-test", chat: "main" }}>
        <MarkdownMembersProvider value={{ members: [], hasMembers: false, source: "", docPath: "", projectCode: "" }}>
          <Probe reason="the hub answered nothing" />
        </MarkdownMembersProvider>
      </MarkdownScopeProvider></MemoryRouter>,
    );
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
  });

  // BOUNDED, or it is a slow leak in his browser. Newest wins.
  it("keeps the record from growing without end", async () => {
    const all = {};
    for (let i = 0; i < 400; i += 1) all[`k${i}`] = i;
    window.localStorage.setItem("sv.blockFault.sent", JSON.stringify(all));
    mount({ projectCode: "systemview-test", chat: "main" });
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    const after = JSON.parse(window.localStorage.getItem("sv.blockFault.sent"));
    expect(Object.keys(after).length).toBeLessThanOrEqual(300);
    expect(after.k0).toBeUndefined();
    expect(after.k399).toBe(399);
  });
});

// TWO FAULTS, AND THE COMPOSER HAD ONE SENTENCE FOR BOTH.
//
// An unproved met-mark was reported as *"a ::claim you wrote points at "c1" and it does not
// resolve — marked met with no proof embedded"*. `c1` resolved: it exists and it is marked. Nothing
// pointed anywhere and nothing failed to resolve, so the message opened on a fault that had not
// happened and sent the reader hunting a bad reference they never wrote.
//
// These claims pin BOTH halves: that a state fault says the true thing, and that the five blocks
// which really do resolve something kept the wording that was already right for them.
describe("a state fault is not a resolution fault", () => {
  it("states the whole fact and never claims a reference failed", () => {
    expect(
      failureSummary({
        kind: "claim",
        ref: "c1",
        fault: "state",
        reason: "marked met with no proof embedded — it does not count as met",
      }),
    ).toBe(
      'the ::claim you wrote at "c1" is marked met with no proof embedded — it does not count as met',
    );
  });

  it("never says points-at or does-not-resolve about a block that resolved", () => {
    const line = failureSummary({ kind: "claim", ref: "c1", fault: "state", reason: "unproved" });
    expect(line).not.toContain("does not resolve");
    expect(line).not.toContain("points at");
  });

  it("still reads when the claim carried no id to locate it by", () => {
    expect(failureSummary({ kind: "claim", fault: "state", reason: "marked met with no proof" })).toBe(
      "the ::claim you wrote is marked met with no proof",
    );
  });

  it("says where, the same way the resolution shape does", () => {
    expect(
      failureSummary({ kind: "claim", ref: "c1", fault: "state", reason: "unproved", where: "this chat" }),
    ).toContain("in this chat");
  });

  // THE REGRESSION LOCK. Five callers — file, test, report, branch, commit — are genuine resolution
  // faults whose copy was always correct. The default is what keeps them right by construction, so
  // the default is what gets pinned.
  it("leaves every resolution caller's sentence byte-identical", () => {
    expect(failureSummary({ kind: "commit", ref: "4ce4444", reason: "no such commit" })).toBe(
      'a ::commit you wrote points at "4ce4444" and it does not resolve — no such commit',
    );
    expect(failureSummary({ kind: "file", ref: "a.js", reason: "there is no path in this reference" })).toBe(
      'a ::file you wrote points at "a.js" and it does not resolve — there is no path in this reference',
    );
    // and passing the default EXPLICITLY is the same sentence as leaving it off
    expect(failureSummary({ kind: "test", ref: "Math.add", reason: "no test named", fault: "unresolved" })).toBe(
      failureSummary({ kind: "test", ref: "Math.add", reason: "no test named" }),
    );
  });

  // A FAULT CHANNEL MUST NOT BREAK ON ITS OWN ARGUMENT — throwing here would mean telling nobody
  // about the fault it was called for, which is the one outcome the mechanism exists to prevent.
  it("falls back to the resolution wording on a shape it does not know", () => {
    expect(failureSummary({ kind: "commit", ref: "abc", reason: "no such commit", fault: "nonsense" })).toBe(
      'a ::commit you wrote points at "abc" and it does not resolve — no such commit',
    );
  });
});

// THE KEYS ARE PERSISTED, so a key format that changes invalidates every key already on his disk
// and re-reports every still-broken block at once. That is the reload-flood this file's history is
// about, and it has now happened twice — the second time measured, 2026-11-11: `fault` was put in
// the key so a reworded message would be sent once more, the unproved-claim nudge then gained
// `fault: "state"`, and the next bundle he took re-reported FORTY claims into his chat while he
// was working on something else.
describe("the dedupe key is the FACT, never the wording", () => {
  it("is exactly kind, ref, reason and audience", () => {
    expect(failureKey({ kind: "commit", ref: "abc", reason: "no such commit", audience: ["a"] })).toBe(
      "commit abc no such commit a",
    );
  });

  it("IGNORES the fault shape entirely — a reworded message is not a new fact", () => {
    const plain = failureKey({ kind: "claim", ref: "c1", reason: "unproved", audience: ["a"] });
    expect(failureKey({ kind: "claim", ref: "c1", reason: "unproved", audience: ["a"], fault: "state" })).toBe(plain);
    expect(failureKey({ kind: "claim", ref: "c1", reason: "unproved", audience: ["a"], fault: "unresolved" })).toBe(plain);
    // and anything invented later must not split the key either
    expect(failureKey({ kind: "claim", ref: "c1", reason: "unproved", audience: ["a"], fault: "whatever" })).toBe(plain);
  });

  it("still separates two different faults on ONE block, because the REASON differs", () => {
    // A claim can be unproved and it can be jammed. They are different facts and each earns its
    // own telling — off the reason, which is what a fault actually is.
    const unproved = failureKey({ kind: "claim", ref: "c1", reason: "marked met with no proof embedded", audience: ["a"] });
    const jammed = failureKey({ kind: "claim", ref: "c1", reason: "closed early by a fence at its own depth", audience: ["a"] });
    expect(unproved).not.toBe(jammed);
  });
});

// AND THROUGH THE REAL HOOK, because a pure function agreeing with itself says nothing about what
// the agent actually receives — the shape has to survive the send.
describe("the shape reaches the message", () => {
  const StateProbe = () => {
    const report = useBlockFailure();
    React.useEffect(() => {
      report({
        kind: "claim",
        ref: "c1",
        fault: "state",
        reason: "marked met with no proof embedded — it does not count as met",
      });
    }, [report]);
    return null;
  };

  it("sends the state wording, not the resolution wording", async () => {
    render(
      <MemoryRouter><MarkdownScopeProvider value={{ projectCode: "systemview-test", chat: "main" }}>
        <MarkdownMembersProvider value={{ members: [], hasMembers: false, source: "", docPath: "", projectCode: "" }}>
          <StateProbe />
        </MarkdownMembersProvider>
      </MarkdownScopeProvider></MemoryRouter>,
    );
    await waitFor(() => expect(sendUpdateTo).toHaveBeenCalledTimes(1));
    const { summary } = sendUpdateTo.mock.calls[0][0];
    // "in this chat" rides along because this probe stands in a room rather than a document — the
    // same `where` the resolution shape carries, which is the point of it being one composer.
    expect(summary).toBe(
      'the ::claim you wrote in this chat at "c1" is marked met with no proof embedded — it does not count as met',
    );
    expect(summary).not.toContain("does not resolve");
  });
});
