import {
  membersLineNo,
  addMemberPlan,
  addThreadMemberPlan,
  membersBlockOf,
  threadBlocksOf,
  threadMembers,
  threadMembersAttr,
  splitWho,
} from "./docMembers";

// THE EDIT CHANNEL'S TESTS LEFT WITH THE EDIT CHANNEL (his ruling, 2026-11-06): general text
// sends no updates, so there is no hash, no sent= map, no dirtiness and no pendingOf to claim.
// Delivery is the engine's — tests/markdown-fires.js and markdown-announce.js in autobot hold
// those claims, gate included.

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

  // THE RIGHT-CLICK DOOR MUST NOT NARROW BY ACCIDENT. Since a bare thread inherits the document's
  // people, writing only the picked name would drop everybody who was in the conversation — the
  // same "press it and they vanish" bug the × was built to avoid, through the other door.
  it("adds the picked member to the people a bare thread INHERITED, not instead of them", () => {
    const plan = addThreadMemberPlan(DOC, 5, "buapi", ["a", "systemlynx"]);
    expect(plan.members).toBe("a|systemlynx|buapi");
  });

  it("still appends to the thread's OWN list when it narrows, inheriting nothing", () => {
    const withOne = DOC.replace(":::thread{id=t1}", ":::thread{id=t1 members=systemlynx}");
    expect(addThreadMemberPlan(withOne, 5, "buapi", ["a"]).members).toBe("systemlynx|buapi");
  });

  it("is idempotent against the inherited list too — adding somebody already in it writes nothing new", () => {
    const plan = addThreadMemberPlan(DOC, 5, "a", ["a"]);
    expect(plan.already).toBe(true);
    expect(plan.members).toBe("a");
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

// ── A BARE THREAD IS ABOUT THE DOCUMENT'S PEOPLE (RFC-071, his 2026-10-20) ────────────────────
// *"I have to individually attach you to each thread, even though you're a member on the entire
// document… it should be more accommodating towards the way I actually use it."* He makes threads
// to wrap one part of a document and say something about it — a dozen of them in a sitting — and
// every one of them was asking him to re-attach the people who were already on the file.
describe("a thread with no members of its own inherits the document's", () => {
  const DOC = [
    "# A plan",                          // 1
    "",                                  // 2
    "::members{who=buapi|systemlynx}",   // 3
    "",                                  // 4
    "::::thread{id=bare}",               // 5
    "wrapping a paragraph to say something about it",
    "::::",
    "",
    "::::thread{id=narrow members=buapi}",  // 9
    "between the two of us",
    "::::",
  ].join("\n");
  const docWho = splitWho(membersBlockOf(DOC).who);

  it("hands a bare thread the document's list, so attaching nobody is the common case working", () => {
    const [bare] = threadBlocksOf(DOC);
    const { who, inherited } = threadMembers(bare.members, docWho);
    expect(who).toEqual(["buapi", "systemlynx"]);
    expect(inherited).toBe(true);
  });

  it("a thread that NAMES people narrows to exactly those and inherits nothing", () => {
    const narrow = threadBlocksOf(DOC)[1];
    const { who, inherited } = threadMembers(narrow.members, docWho);
    expect(who).toEqual(["buapi"]);
    expect(inherited).toBe(false);
  });

  // The rhythm this exists for: *"I typically like to make multiple threads and then send you an
  // update."* Inheritance has to hold for every one of them, not just the first.
  it("holds across every bare thread in the document, however many he makes", () => {
    const many = [
      "::members{who=sv|autobot}",
      "# meeting",
      "::::thread{id=a}",
      "a",
      "::::",
      "::::thread{id=b}",
      "b",
      "::::",
      "::::thread{id=c}",
      "c",
      "::::",
    ].join("\n");
    const who = splitWho(membersBlockOf(many).who);
    expect(threadBlocksOf(many).map((t) => threadMembers(t.members, who).who)).toEqual([
      ["sv", "autobot"],
      ["sv", "autobot"],
      ["sv", "autobot"],
    ]);
  });

  // INHERITING NOBODY IS NOBODY. A document with no `::members` line has no audience to lend, and
  // a thread on it must not invent one — this is most markdown in the repo.
  it("gives a bare thread nobody when the document has no members line at all", () => {
    const plain = "# notes\n\n:::thread{id=t1}\nq\n:::\n";
    expect(membersBlockOf(plain)).toBe(null);
    const [t1] = threadBlocksOf(plain);
    expect(threadMembers(t1.members, []).who).toEqual([]);
  });

  // SOMEBODY BROUGHT IN FOR ONE CONVERSATION is the case narrowing serves: the thread's list is
  // the whole list, whether or not those people are on the document.
  it("keeps a member the thread names and the document does not", () => {
    const src = ["::members{who=sv}", "# d", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
    const [t1] = threadBlocksOf(src);
    expect(threadMembers(t1.members, splitWho(membersBlockOf(src).who)).who).toEqual(["buapi"]);
  });

  // THE DIFFERENCE INHERITANCE TURNS ON, and the reason the row carries `members` as well as `who`:
  // "" is what `who` says for a thread that names nobody AND for one narrowed to nobody on purpose.
  it("tells a line that says nothing from a line that says nobody", () => {
    const src = ["::members{who=a|b}", '::::thread{id=none members=""}', "x", "::::", "::::thread{id=bare}", "y", "::::"].join("\n");
    const [none, bare] = threadBlocksOf(src);
    expect(none.members).toBe("");
    expect(bare.members).toBe(null);
    expect(threadMembers(none.members, ["a", "b"])).toEqual({ who: [], inherited: false });
    expect(threadMembers(bare.members, ["a", "b"]).who).toEqual(["a", "b"]);
  });
});

// REMOVAL IS THE HALF A FUTURE CHANGE WILL BREAK, because the obvious implementation of × on an
// inherited chip — "remove them from the list" — has no list to remove from. His requirement,
// 2026-10-20: *"I still have the ability to delete them if I wanted to make it different."*
describe("threadMembersAttr — dropping an inherited chip materialises the narrowed list", () => {
  it("writes everyone inherited MINUS the one dropped, so the thread stops inheriting", () => {
    // the × on buapi, in a thread inheriting buapi|systemlynx
    expect(threadMembersAttr(["systemlynx"], ["buapi", "systemlynx"])).toBe("systemlynx");
  });

  // THE BUG THIS PREVENTS: clear the attribute on the last one and the next render hands the
  // document's people straight back — press ×, they reappear, and the control looks broken.
  it("emptying it means NOBODY, not inheriting again", () => {
    expect(threadMembersAttr([], ["buapi", "systemlynx"])).toBe("");
  });

  // …but there is nothing to inherit on a document with no members, so the attribute is removed
  // rather than left saying "" — the same write the right-click clear-all always made.
  it("removes the attribute instead when the document has nobody to inherit", () => {
    expect(threadMembersAttr([], [])).toBe(null);
  });

  it("round-trips: what it writes is what threadMembers reads back", () => {
    const narrowed = threadMembersAttr(["systemlynx"], ["buapi", "systemlynx"]);
    expect(threadMembers(narrowed, ["buapi", "systemlynx"])).toEqual({ who: ["systemlynx"], inherited: false });
    const emptied = threadMembersAttr([], ["buapi"]);
    expect(threadMembers(emptied, ["buapi"])).toEqual({ who: [], inherited: false });
  });

  it("de-duplicates and ignores blanks rather than writing a member twice", () => {
    expect(threadMembersAttr(["a", "a", "", "b"], [])).toBe("a|b");
  });
});

describe("RFC-073 §2.1 — a thread's audience is subscribe=, and members= still answers", () => {
  const doc = [
    "::members{who=buapi|systemlynx}",
    "",
    "::::thread{id=t1 subscribe=buapi}",
    "x",
    "::::",
    "",
    "::::thread{id=t2 members=systemlynx}",
    "y",
    "::::",
  ].join("\n");
  it("threadBlocksOf reads subscribe= first and legacy members= as the same thing (c21)", () => {
    const [t1, t2] = threadBlocksOf(doc);
    expect(t1.members).toBe("buapi");
    expect(t2.members).toBe("systemlynx");
  });
  it("addThreadMemberPlan grows a subscribe= audience without dropping it", () => {
    const plan = addThreadMemberPlan(doc, 3, "reviewer-x", ["buapi", "systemlynx"]);
    expect(plan).toEqual({ line: 3, members: "buapi|reviewer-x" });
  });
});

// RFC-075 round two — clear ALL threads: wrappers and their replies go, the wrapped content stays.
describe("clearAllThreads — the conversations go, the writing stays", () => {
  const { clearAllThreads } = require("./docMembers");
  const DOC = [
    "# Title",
    "",
    "::::thread{id=t1 subscribe=buapi}",
    "The paragraph the thread wrapped.",
    ":::reply{author=you ts=1}",
    "a reply that goes",
    ":::",
    "::::",
    "",
    "plain prose between",
    "",
    ":::thread{id=t2}",
    "another wrapped line",
    ":::",
    "",
    "```markdown",
    ":::thread{id=example}",
    "never touched — it is a quotation",
    ":::",
    "```",
  ].join("\n");

  it("removes every wrapper and every reply, keeps the wrapped content and the fenced example", () => {
    const next = clearAllThreads(DOC);
    expect(next).toContain("The paragraph the thread wrapped.");
    expect(next).toContain("another wrapped line");
    expect(next).toContain(":::thread{id=example}"); // the quotation survives
    expect(next).not.toContain("thread{id=t1");
    expect(next).not.toContain("thread{id=t2");
    expect(next).not.toContain("a reply that goes");
    expect(next).not.toContain(":::reply");
  });

  it("a document with no threads answers null — a no-op is not a change", () => {
    expect(clearAllThreads("# just prose\n\nwords")).toBe(null);
  });

  it("an unbalanced thread is left alone rather than guessed at", () => {
    const broken = "::::thread{id=t1}\nwords with no closer";
    expect(clearAllThreads(broken)).toBe(null);
  });
});

// RFC-075 round two — the jam detector: one orphan fence used to disable self-healing silently.
describe("fenceHealth — a document that cannot self-heal says where", () => {
  const { fenceHealth } = require("./docMembers");
  it("a balanced document is ok", () => {
    expect(fenceHealth("::::thread{id=t}\n:::reply{a=b}\nhi\n:::\n::::").ok).toBe(true);
  });
  it("an orphan close names its line", () => {
    const fh = fenceHealth("fine\n:::\nmore");
    expect(fh.ok).toBe(false);
    expect(fh.line).toBe(2);
    expect(fh.why).toContain("nothing open");
  });
  it("a container that never closes names its opening line", () => {
    const fh = fenceHealth(":::thread{id=t}\nwords forever");
    expect(fh.ok).toBe(false);
    expect(fh.line).toBe(1);
  });
  it("fences in code blocks are examples, not structure", () => {
    expect(fenceHealth("```md\n:::\n```").ok).toBe(true);
  });
});
