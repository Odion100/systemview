import { listeningScope, openChats } from "./listeningScope";

// His ask: *"it's going to use whichever agent's tab is open. So if I'm talking to you, that's the
// voice it's going to use."* The voice lookup is already per chat; this picks the scope it is made
// under, which is the whole of the decision.
describe("whose voice reads the document", () => {
  it("is the open chat's agent, NOT the document's project", () => {
    expect(listeningScope(["systemview-test"], { route: "BUApp", doc: "BUApp" })).toBe("systemview-test");
  });

  it("with several chats open, the one he is on wins", () => {
    expect(listeningScope(["BUApp", "systemview-test"], { route: "BUApp", doc: "autobot" })).toBe("BUApp");
  });

  it("with several open and none of them his, the answer is arbitrary but STABLE", () => {
    // Stable so a wrong answer can be noticed and reported, instead of sounding like a new bug
    // every time. Order of the input must not change it.
    expect(listeningScope(["systemview-test", "BUApp"], { route: "autobot" })).toBe("BUApp");
    expect(listeningScope(["BUApp", "systemview-test"], { route: "autobot" })).toBe("BUApp");
  });

  it("falls back to the route and then the document when no chat is open", () => {
    expect(listeningScope([], { route: "autobot", doc: "BUApp" })).toBe("autobot");
    expect(listeningScope([], { doc: "BUApp" })).toBe("BUApp");
    expect(listeningScope([], {})).toBe("");
  });

  it("ignores empties and duplicates rather than treating them as chats", () => {
    expect(listeningScope(["", null, "bu1", "bu1"], { route: "x" })).toBe("bu1");
  });
});

describe("reading the open chats off disk", () => {
  beforeEach(() => window.localStorage.clear());

  it("answers only the chats that are actually open", () => {
    window.localStorage.setItem("sv.chat.open.systemview-test", "1");
    window.localStorage.setItem("sv.chat.open.BUApp", "0");
    window.localStorage.setItem("sv.chatHidden.autobot", "1");
    expect(openChats()).toEqual(["systemview-test"]);
  });

  it("is an empty list, never a throw, when there is nothing to read", () => {
    expect(openChats()).toEqual([]);
  });
});
