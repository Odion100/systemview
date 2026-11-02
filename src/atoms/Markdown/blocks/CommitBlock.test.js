import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CommitBlock from "./CommitBlock";
import { useCapability, useCapabilityState } from "../capabilities";
import { useMarkdownScope, useMarkdownWrite, useDocMembers } from "../context";

// A COMMIT RECORD ARRIVES MINIMIZED — that is the whole point of the posture: several records in
// one reply at full height is a wall. Which makes every way IN to a record load-bearing, and there
// are two: the chevron in the corner and the sha. The sha used to set the log tab underneath a
// hidden body, so the press did everything except the one thing you could see.
jest.mock("../capabilities", () => ({
  useCapability: jest.fn(),
  useCapabilityState: jest.fn(),
}));
jest.mock("../context", () => ({
  useMarkdownScope: jest.fn(),
  useMarkdownWrite: jest.fn(() => ({})),
  useDocMembers: jest.fn(() => ({})),
}));
// `useBlockFailure` RETURNS THE REPORTER ITSELF, not an object holding one — mocking the
// shape wrong here would have failed the same way the real block fails when a hub door
// changes shape under it, which is the bug class this file exists for.
jest.mock("../blockFailure", () => ({ useBlockFailure: () => async () => {} }));
jest.mock("../docSend", () => ({ sendUpdateTo: async () => {} }));

const SHA = "ac23f999";
const OLD_SHA = "0000dead";

// The hub, answering the three things a record asks for: the commit itself, the repo's state, and
// a log. Shaped like the real doors — inventing a field here is how a suite stays green while the
// window renders nothing.
const hub = (log) => ({
  Plugin: {
    commitRecord: async (sha) => ({
      ok: true,
      sha,
      subject: "fix(voice): a voiced chip says it is voiced",
      body: "",
      author: "odion",
      at: Date.now(),
      files: [{ path: "src/a.js", added: 3, removed: 1 }],
      ahead: 0,
      behind: 0,
    }),
    gitState: async () => ({ repo: true, branch: "main", ahead: 0, behind: 0, staged: [], unstaged: [], log }),
  },
});

const mount = ({ sha = SHA, log = [{ sha: SHA, subject: "fix(voice)" }] } = {}) => {
  useMarkdownScope.mockReturnValue({ projectCode: "systemview-test" });
  useCapability.mockReturnValue(hub(log));
  useCapabilityState.mockReturnValue({ ready: true });
  useDocMembers.mockReturnValue({});
  useMarkdownWrite.mockReturnValue({ editable: false, setAttr: () => {} });
  return render(<CommitBlock attrs={{ sha }} line={1} />);
};

describe("a commit record's two ways in", () => {
  it("arrives minimized — the body is not on screen", async () => {
    mount();
    await screen.findByText(SHA);
    expect(screen.queryByRole("button", { name: /^log$/ })).toBeNull();
  });

  it("the sha OPENS it, the way the chevron does", async () => {
    mount();
    const stamp = await screen.findByText(SHA);
    fireEvent.click(stamp);
    await waitFor(() => expect(screen.getByRole("button", { name: /^log$/ })).toBeTruthy());
  });

  // A PRESS THAT CANNOT JUMP STILL OPENS. The log is the last forty commits, so a record older
  // than that has no row to land on — which is a reason to skip the jump and never a reason to
  // refuse the press. Disabled, it read as a dead control on exactly the records that are hardest
  // to find by hand.
  it("opens even when the commit is older than the log", async () => {
    mount({ sha: OLD_SHA, log: [{ sha: "ffff1111", subject: "something else" }] });
    const stamp = await screen.findByText(OLD_SHA);
    expect(stamp.closest("button").disabled).toBe(false);
    fireEvent.click(stamp);
    await waitFor(() => expect(screen.getByRole("button", { name: /^log$/ })).toBeTruthy());
  });
});
