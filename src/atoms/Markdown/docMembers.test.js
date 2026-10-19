import {
  bodyOf,
  hashOf,
  parseSent,
  serializeSent,
  dirtyMembers,
  summarize,
  membersLineNo,
  addMemberPlan,
  addThreadMemberPlan,
  membersBlockOf,
  threadBlocksOf,
  lastReplyOf,
  pendingOf,
} from "./docMembers";

// RFC-071 — WHO IS BEHIND ON THIS DOCUMENT. The trap this file exists to avoid is the obvious
// implementation: hash the document, compare. Sending REWRITES the members line (it records the
// new hash), so hashing the whole file makes every send instantly dirty again and the surface can
// never say anything but "behind".
describe("the hash is of the document WITHOUT its members line", () => {
  const body = "# A plan\n\nsome prose\n";
  it("ignores the members line entirely", () => {
    expect(hashOf(`::members{who=buapi}\n${body}`)).toBe(hashOf(body));
    expect(hashOf(`::members{who=buapi sent=buapi:abc}\n${body}`)).toBe(hashOf(body));
  });
  it("so recording a send does not make the document dirty again", () => {
    const before = `::members{who=buapi}\n${body}`;
    const stamp = hashOf(before);
    const after = `::members{who=buapi sent=buapi:${stamp}}\n${body}`;
    expect(dirtyMembers(["buapi"], parseSent(`buapi:${stamp}`), after)).toEqual([]);
  });
  it("but a real change to the body IS dirty", () => {
    const stamp = hashOf(body);
    const edited = `::members{who=buapi sent=buapi:${stamp}}\n${body}and a new line\n`;
    expect(dirtyMembers(["buapi"], parseSent(`buapi:${stamp}`), edited)).toEqual(["buapi"]);
  });
  it("a reply posted in a thread counts as a change — that IS the news", () => {
    const withThread = `${body}:::thread{id=t1}\nq\n:::\n`;
    const stamp = hashOf(withThread);
    const replied = `${body}:::thread{id=t1}\nq\n:::reply{author=you ts=1}\nan answer\n:::\n:::\n`;
    expect(dirtyMembers(["buapi"], { buapi: stamp }, replied)).toEqual(["buapi"]);
  });
  it("strips every members line, wherever it sits", () => {
    expect(bodyOf("a\n::members{who=x}\nb\n")).toBe("a\nb\n".replace(/\n$/, "\n"));
  });
});

describe("each member carries their own last-send", () => {
  it("round-trips the pairs", () => {
    const map = { buapi: "1a2b", systemlynx: "3c4d" };
    expect(parseSent(serializeSent(map))).toEqual(map);
  });
  it("a member never sent to is dirty by construction — they have heard nothing", () => {
    expect(dirtyMembers(["buapi", "systemlynx"], { buapi: hashOf("x") }, "x")).toEqual(["systemlynx"]);
  });
  it("sending to one leaves the other behind — the whole reason the stamp is per member", () => {
    const src = "# plan\n";
    const stamp = hashOf(src);
    expect(dirtyMembers(["a", "b"], { a: stamp }, src)).toEqual(["b"]);
  });
  it("junk in the attribute is ignored rather than crashing the document", () => {
    expect(parseSent("garbage|:|buapi:ok")).toEqual({ buapi: "ok" });
    expect(parseSent(undefined)).toEqual({});
    expect(serializeSent({ a: "", b: "x" })).toBe("b:x");
  });
});

describe("the summary is the one line that says whether this is worth a turn", () => {
  it("counts what moved and whether they have been told before", () => {
    const s = summarize("# p\n:::thread{id=t}\nq\n:::reply{author=you ts=1}\na\n:::\n:::\n", true);
    expect(s).toMatch(/1 thread/);
    expect(s).toMatch(/1 reply/);
    expect(s).toMatch(/changed since you were last sent to/);
  });
  it("says so plainly when the member has never been sent to", () => {
    expect(summarize("# p\n", false)).toMatch(/have not been sent to before/);
  });
});

// ADDING A MEMBER — the write that went wrong in his hands: *"I'm trying to add somebody as a
// member of the document. They became a member of the thread below."*
describe("adding a member lands on the right line", () => {
  const DOC = [
    "# RFC-071 — a title",            // 1
    "",                                // 2
    "**A lead paragraph.**",           // 3
    "",                                // 4
    "::members{who=systemview-test}",  // 5
    "",                                // 6
    "## 1 · A section",                // 7
    ":::thread{id=t1}",                // 8
    "the ask",                         // 9
    ":::",                             // 10
  ].join("\n");

  it("finds the members line, 1-based, the way setDirectiveAttr counts", () => {
    expect(membersLineNo(DOC)).toBe(5);
    expect(DOC.split("\n")[membersLineNo(DOC) - 1]).toMatch(/^::members/);
  });

  it("adds to the DOCUMENT's line — never the thread below it", () => {
    const plan = addMemberPlan(DOC, "buapi");
    expect(plan.line).toBe(5);
    expect(plan.who).toBe("systemview-test|buapi");
    // the line it points at is the members line, not the thread
    expect(DOC.split("\n")[plan.line - 1]).toMatch(/^::members/);
    expect(DOC.split("\n")[plan.line - 1]).not.toMatch(/thread/);
  });

  it("is idempotent — adding somebody already on it changes nothing", () => {
    const plan = addMemberPlan(DOC, "systemview-test");
    expect(plan.already).toBe(true);
    expect(plan.who).toBe("systemview-test");
  });

  it("creates the line under the document's head when there is none", () => {
    const bare = "# A title\n\nlead\n\n## First section\nbody\n";
    const plan = addMemberPlan(bare, "buapi");
    expect(plan.text).toBe("::members{who=buapi}");
    // after the lead, before the first real heading
    expect(bare.split("\n")[plan.insertAfter]).toBe("## First section");
  });

  it("refuses an empty name rather than writing an empty member", () => {
    expect(addMemberPlan(DOC, "  ")).toBe(null);
  });
});

describe("a thread's members are the thread's", () => {
  const DOC = "# t\n\n::members{who=a}\n\n:::thread{id=t1}\nq\n:::\n";

  it("writes on the thread's opening line, and only there", () => {
    const plan = addThreadMemberPlan(DOC, 5, "buapi");
    expect(plan.line).toBe(5);
    expect(plan.members).toBe("buapi");
    expect(DOC.split("\n")[4]).toMatch(/^:::thread/);
  });

  it("appends to a thread that already names people", () => {
    const withOne = DOC.replace(":::thread{id=t1}", ":::thread{id=t1 members=systemlynx}");
    expect(addThreadMemberPlan(withOne, 5, "buapi").members).toBe("systemlynx|buapi");
  });

  it("REFUSES a line that is not a thread — the guard against the document's line being hit", () => {
    expect(addThreadMemberPlan(DOC, 3, "buapi")).toBe(null); // line 3 is ::members
    expect(addThreadMemberPlan(DOC, 1, "buapi")).toBe(null); // line 1 is the title
  });
});

// ── A THREAD IS ITS OWN SUBSCRIPTION (RFC-071, his 2026-10-19) ─────────────────────────────────
// *"I hope updates that are thread level also go up there as well… it's supposed to be for both"*
// and *"I might have you subscribed on multiple levels, but only want to send you the thread
// update."* Both demand that a thread have its own version to be behind on — which means parsing
// the threads out of the document and hashing each one over its own body.
describe("threadBlocksOf — every thread, its line, its people, its body", () => {
  const DOC = [
    "# A plan",
    "",
    "::members{who=buapi|systemlynx}",
    "",
    "::::thread{id=t1 members=buapi sent=buapi:abc auto=buapi}",
    "the argument",
    ":::reply{author=you ts=1}",
    "a reply, which closes with three colons",
    ":::",
    "::::",
    "",
    ":::thread{id=t2}",
    "no members here",
    ":::",
  ].join("\n");

  it("finds each thread with its 1-based line and its attributes", () => {
    const [t1, t2] = threadBlocksOf(DOC);
    expect(t1.line).toBe(5);
    expect(t1.id).toBe("t1");
    expect(t1.who).toBe("buapi");
    expect(t1.sent).toBe("buapi:abc");
    expect(t1.auto).toBe("buapi");
    expect(t2.id).toBe("t2");
    expect(t2.who).toBe("");
  });

  // The fence that closes a thread is NOT the next line of colons — a reply inside it closes with
  // the same three. Matching by depth is the difference between a thread's body and half of one.
  it("closes a thread by depth, so an inner reply's fence is not mistaken for the thread's", () => {
    const [t1] = threadBlocksOf(DOC);
    expect(t1.body).toContain("the argument");
    expect(t1.body).toContain("a reply, which closes with three colons");
    expect(t1.body).not.toContain("no members here");
  });

  // Stamping `sent=` on the opener must not make the thread dirty again — the same rule the
  // document's hash follows about its own `::members` line.
  it("excludes the opening line from the body, so telling somebody cannot re-dirty the thread", () => {
    const [t1] = threadBlocksOf(DOC);
    expect(t1.body.startsWith("the argument")).toBe(true);
  });
});

describe("lastReplyOf — a thread member is told what was said", () => {
  it("takes the last reply's words, not a count of them", () => {
    const body = [":::reply{author=you ts=1}", "first", ":::", ":::reply{author=you ts=2}", "Let's get dirty.", ":::"].join("\n");
    expect(lastReplyOf(body)).toBe("Let's get dirty.");
  });
  it("is empty on a thread nobody has replied in", () => {
    expect(lastReplyOf("just the argument")).toBe("");
  });
});

describe("pendingOf — every pending update in the document, both levels, distinctly", () => {
  const SRC = ["::members{who=buapi}", "# plan", "::::thread{id=t1 members=buapi}", "talk", "::::"].join("\n");
  const block = membersBlockOf(SRC);
  const threads = threadBlocksOf(SRC);

  it("lists the document and each thread as SEPARATE scopes, never merged", () => {
    const pending = pendingOf(block, threads, SRC);
    expect(pending.map((p) => p.kind)).toEqual(["document", "thread"]);
    expect(pending[1].id).toBe("t1");
    // Different lines, which is what makes one press stamp one subscription.
    expect(pending[0].line).not.toBe(pending[1].line);
  });

  // HIS CASE, verbatim: *"I might have you subscribed on multiple levels, but only want to send you
  // the thread update."* Telling buapi about t1 must leave buapi behind on the document.
  it("a member told about the thread stays behind on the document", () => {
    const threadStamp = { [threads[0].line]: { buapi: hashOf(threads[0].body) } };
    const pending = pendingOf(block, threads, SRC, threadStamp);
    expect(pending.map((p) => p.kind)).toEqual(["document"]);
    expect(pending[0].behind).toEqual(["buapi"]);
  });

  it("leaves out a thread nobody is on, however much it has moved", () => {
    const src = ["::members{who=buapi sent=buapi:x}", ":::thread{id=t9}", "nobody here", ":::"].join("\n");
    const pending = pendingOf(membersBlockOf(src), threadBlocksOf(src), src);
    expect(pending.every((p) => p.kind !== "thread")).toBe(true);
  });
});
