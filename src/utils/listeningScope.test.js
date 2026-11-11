import { listeningScope, openChats } from "./listeningScope";
import { markLastChat, readLastChat } from "./lastChat";

// His ask: *"it's going to use whichever agent's tab is open. So if I'm talking to you, that's the
// voice it's going to use."* The voice lookup is already per chat; this picks the scope it is made
// under, which is the whole of the decision.
describe("whose voice reads the document", () => {
  it("is the chat he was LAST IN, not the document's project", () => {
    expect(listeningScope(["systemview-test"], { last: "systemview-test", route: "BUApp", doc: "BUApp" })).toBe(
      "systemview-test",
    );
  });

  // HIS CASE, and the one that killed the first version of this rule: every agent docked, the panel
  // minimised to the edge. "In a way, everyone is out" — so openness discriminates nothing and the
  // tie-break under it would have read him a document in whichever agent sorted first.
  it("picks him out of a dock where EVERY chat is open", () => {
    const everyone = ["autobot", "BUApp", "bu1", "systemview-test", "systemlynx"];
    expect(listeningScope(everyone, { last: "systemview-test", route: "BUApp" })).toBe("systemview-test");
    expect(listeningScope(everyone, { last: "bu1", route: "BUApp" })).toBe("bu1");
  });

  it("holds even when that chat is minimised and NOT in the open list", () => {
    // A chat docked to the edge is still the room he was last in. Openness is presence; this is
    // attention, and attention is what the question is actually about.
    expect(listeningScope([], { last: "systemview-test", route: "BUApp", doc: "autobot" })).toBe("systemview-test");
    expect(listeningScope(["BUApp"], { last: "systemview-test", route: "BUApp" })).toBe("systemview-test");
  });

  it("beats the route, which only happened to be right", () => {
    // Reading a BUApp document while talking to systemview-test must sound like systemview-test.
    expect(listeningScope(["BUApp", "systemview-test"], { last: "systemview-test", route: "BUApp" })).toBe(
      "systemview-test",
    );
  });

  // The branches below only run before anything has ever been stamped on this machine.
  it("with nothing stamped yet and several open, the one he is on wins", () => {
    expect(listeningScope(["BUApp", "systemview-test"], { route: "BUApp", doc: "autobot" })).toBe("BUApp");
  });

  it("with nothing stamped and none of them his, the answer is arbitrary but STABLE", () => {
    expect(listeningScope(["systemview-test", "BUApp"], { route: "autobot" })).toBe("BUApp");
    expect(listeningScope(["BUApp", "systemview-test"], { route: "autobot" })).toBe("BUApp");
  });

  it("falls back to the route and then the document when there is nothing else at all", () => {
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

describe("the room is stamped by attention, and survives a reload", () => {
  beforeEach(() => window.localStorage.clear());

  it("remembers the chat he was last in", () => {
    markLastChat("systemview-test");
    expect(readLastChat()).toBe("systemview-test");
    markLastChat("bu1");
    expect(readLastChat()).toBe("bu1");
  });

  it("an empty stamp changes nothing — a missing project must not erase the room", () => {
    markLastChat("systemview-test");
    markLastChat("");
    markLastChat(null);
    expect(readLastChat()).toBe("systemview-test");
  });

  it("answers empty before anything has ever been stamped", () => {
    expect(readLastChat()).toBe("");
  });
});
