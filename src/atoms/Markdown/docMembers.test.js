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
  threadMembers,
  threadMembersAttr,
  splitWho,
  everyoneBehind,
  lastReplyOf,
  threadSummary,
  lastReplyAuthorOf,
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

// INHERITANCE IS ABOUT WHO IS ON A THREAD, NOT ABOUT WHO IS BEHIND — and a row is the narrower
// subscription, so inheritance must not manufacture one. The arithmetic: a bare thread's people are
// the document's, so they are either current on the document (behind on nothing, by the rule above)
// or already standing in the document's own row. A row per bare thread would tell them the same
// news a second time and cost the flood this file was given to kill — four rows, four presses, four
// separate wakes for one agent, measured live 2026-10-20.
describe("pendingOf — every thread can be pressed on its own (his reversal, 2026-10-26)", () => {
  const SRC = ["::members{who=sv|autobot}", "# meeting", "::::thread{id=a}", "a", "::::", "::::thread{id=b}", "b", "::::"].join("\n");

  // *"Per-thread should still be able to work"* — a bare thread inherits its people AND gets a row,
  // so a surgical thread-send exists whether or not somebody typed members=.
  it("bare threads get rows beside the document's — the per-thread send works on inherited threads", () => {
    const pending = pendingOf(membersBlockOf(SRC), threadBlocksOf(SRC), SRC);
    expect(pending.map((p) => p.kind)).toEqual(["document", "thread", "thread"]);
    expect(pending[0].behind).toEqual(["sv", "autobot"]);
  });

  // THE FLOOD GUARD THAT SURVIVES THE REVERSAL: anyone current on the DOCUMENT appears on no
  // thread row, so one document press still clears everything.
  it("a member current on the document is on no thread row, however bare the threads", () => {
    const whole = hashOf(SRC);
    const current = SRC.replace("::members{who=sv|autobot}", `::members{who=sv|autobot sent=sv:${whole}|autobot:${whole}}`);
    const pending = pendingOf(membersBlockOf(current), threadBlocksOf(current), current);
    expect(pending).toEqual([]);
  });

  it("gives the narrowed thread a row of its own, beside the document's", () => {
    const narrowed = SRC.replace("::::thread{id=b}", "::::thread{id=b members=autobot}");
    const pending = pendingOf(membersBlockOf(narrowed), threadBlocksOf(narrowed), narrowed);
    expect(pending.map((p) => p.kind)).toEqual(["document", "thread", "thread"]);
    expect(pending[2].id).toBe("b");
  });

  it("a thread narrowed to nobody is on nobody's row — but its bare sibling keeps one", () => {
    const empty = SRC.replace("::::thread{id=b}", '::::thread{id=b members=""}');
    const kinds = pendingOf(membersBlockOf(empty), threadBlocksOf(empty), empty);
    expect(kinds.filter((p) => p.kind === "thread").map((p) => p.id)).toEqual(["a"]);
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

  it("an inherited thread's row carries the document's people when they are behind", () => {
    const src = ["::members{who=buapi sent=buapi:x}", ":::thread{id=t9}", "nobody here", ":::"].join("\n");
    const pending = pendingOf(membersBlockOf(src), threadBlocksOf(src), src);
    const row = pending.find((p) => p.kind === "thread");
    expect(row && row.id).toBe("t9");
    expect(row.behind).toEqual(["buapi"]);
  });
});

// A CREATION IS NOT A MOVE — measured live 2026-10-20 on this meeting's first send.
describe("threadSummary — the first send on a thread is a creation, not a reply", () => {
  it("says you were added when nothing has been said yet", () => {
    expect(threadSummary("bugs", "Anything that did not work, the moment it did not work.")).toBe(
      "added to thread bugs — nothing said in it yet"
    );
  });

  it("never produces a dangling colon, which is what shipped", () => {
    expect(threadSummary("bugs", "")).not.toMatch(/:\s*$/);
    expect(threadSummary("bugs", null)).not.toMatch(/:\s*$/);
  });

  it("carries the reply itself once there is one — the words are the news", () => {
    const body = "prompt\n:::reply{author=autobot ts=1}\nthe verb could not reach me\n:::";
    expect(threadSummary("bugs", body)).toBe("reply in thread bugs: the verb could not reach me");
  });

  it("carries the LAST reply when a thread has several", () => {
    const body = ":::reply{author=a ts=1}\nfirst\n:::\n:::reply{author=b ts=2}\nsecond\n:::";
    expect(threadSummary("t", body)).toBe("reply in thread t: second");
  });

  // A THREAD WHOSE ONLY REPLY IS EMPTY is still a creation as far as the reader is concerned —
  // there is nothing to go and read, so the sentence must not claim there is.
  it("treats a blank reply as nothing said rather than announcing emptiness", () => {
    expect(threadSummary("t", ":::reply{author=a ts=1}\n\n:::")).toBe("added to thread t — nothing said in it yet");
  });
});

// DOCUMENT MEMBERSHIP MEANS ALL THREADS — his rule, 2026-10-20, and the flood it was given for.
describe("pendingOf — a document member is told once, not once per row", () => {
  // THE LIVE CASE: the meeting had four rows and two members, so bringing autobot current cost
  // four separate wakes, each a whole turn landing cold in the middle of unrelated work.
  const FLOOD = [
    "::members{who=sv|autobot}",
    "# meeting",
    "::::thread{id=obj-1 members=sv|autobot}",
    "a",
    "::::",
    "::::thread{id=bugs members=sv|autobot}",
    "b",
    "::::",
    "::::thread{id=procedure members=sv|autobot}",
    "c",
    "::::",
  ].join("\n");

  it("shows four rows when nobody has been told anything", () => {
    const pending = pendingOf(membersBlockOf(FLOOD), threadBlocksOf(FLOOD), FLOOD);
    expect(pending.map((p) => p.kind)).toEqual(["document", "thread", "thread", "thread"]);
  });

  it("ONE press on the document clears every row — four wakes become one", () => {
    const block = membersBlockOf(FLOOD);
    const told = { [block.line]: { sv: hashOf(FLOOD), autobot: hashOf(FLOOD) } };
    expect(pendingOf(block, threadBlocksOf(FLOOD), FLOOD, told)).toEqual([]);
  });

  it("clears the rows per member — telling one leaves the other on all of them", () => {
    const block = membersBlockOf(FLOOD);
    const told = { [block.line]: { sv: hashOf(FLOOD) } };
    const pending = pendingOf(block, threadBlocksOf(FLOOD), FLOOD, told);
    expect(pending.every((p) => p.behind.length === 1 && p.behind[0] === "autobot")).toBe(true);
    expect(pending).toHaveLength(4);
  });

  // HIS OLDER RULE SURVIVES: a member BEHIND on the document is still reachable thread by thread.
  it("keeps the thread rows for a member who is behind on the document", () => {
    const pending = pendingOf(membersBlockOf(FLOOD), threadBlocksOf(FLOOD), FLOOD);
    expect(pending.filter((p) => p.kind === "thread").map((p) => p.id)).toEqual(["obj-1", "bugs", "procedure"]);
  });

  // A STALE DOCUMENT STAMP IS NOT CURRENT. Told about an older version, a reply lands — they are
  // behind again everywhere, which is the whole point of hashing the source rather than a flag.
  it("a document stamp from an older version does not cover the threads", () => {
    const block = membersBlockOf(FLOOD);
    const told = { [block.line]: { autobot: hashOf("something else entirely") } };
    const pending = pendingOf(block, threadBlocksOf(FLOOD), FLOOD, told);
    expect(pending.filter((p) => p.kind === "thread")).toHaveLength(3);
  });

  // SOMEONE BROUGHT IN FOR ONE CONVERSATION is on no document line at all, so nothing about the
  // document can ever cover them. This is the case a thread row exists to serve.
  it("a thread-only member is never covered by the document", () => {
    const src = ["::members{who=sv}", "# d", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
    const block = membersBlockOf(src);
    const told = { [block.line]: { sv: hashOf(src) } };
    const pending = pendingOf(block, threadBlocksOf(src), src, told);
    expect(pending.map((p) => p.kind)).toEqual(["thread"]);
    expect(pending[0].behind).toEqual(["buapi"]);
  });
});

// THE PERSON IS THE UNIT, NOT THE ROW — what the "tell everyone" press counts at him.
describe("everyoneBehind — counts people, not controls", () => {
  it("counts a person once however many rows they are behind on", () => {
    const pending = [{ behind: ["sv", "autobot"] }, { behind: ["autobot"] }, { behind: ["sv"] }];
    expect(everyoneBehind(pending)).toEqual(["sv", "autobot"]);
  });

  it("is empty when nothing is pending", () => {
    expect(everyoneBehind([])).toEqual([]);
    expect(everyoneBehind()).toEqual([]);
  });

  it("survives a malformed scope rather than taking the pin down", () => {
    expect(everyoneBehind([null, {}, { behind: null }, { behind: ["a"] }])).toEqual(["a"]);
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

// WHO WROTE THE LAST REPLY — the field that keeps a send away from its own author.
//
// This exists because `by` was always the literal "you", so the harness could not tell "autobot
// answered" from "you answered" and guessed with `!e.thread` — which woke an agent with its own
// reply, and is the one thing between hub-side auto and an A-replies-A-is-woken loop.
describe("lastReplyAuthorOf — a send has to know whose news it is", () => {
  const body = [
    ":::reply{author=systemview-test ts=1}", "first", ":::",
    ":::reply{author=autobot ts=2}", "an answer", ":::",
  ].join("\n");

  it("names the author of the LAST reply, not the first", () => {
    expect(lastReplyAuthorOf(body)).toBe("autobot");
  });

  it("is empty when nobody has replied — so no member is skipped on a guess", () => {
    expect(lastReplyAuthorOf("just the argument")).toBe("");
    expect(lastReplyAuthorOf("")).toBe("");
  });

  it("survives a quoted author and extra attributes", () => {
    expect(lastReplyAuthorOf(':::reply{ts=9 author="systemview-test"}\nx\n:::')).toBe("systemview-test");
  });

  // A reply fence gains colons when it sits inside a deeper block, the same way a thread's does.
  it("reads a reply at any fence depth", () => {
    expect(lastReplyAuthorOf("::::reply{author=buapi ts=3}\nx\n::::")).toBe("buapi");
  });

  // THE PAIR THAT MATTERS: the author is the one member a thread send must NOT reach, and
  // everybody else still has to.
  it("is the member a send must skip, while the rest stay behind", () => {
    expect(dirtyMembers(["systemview-test", "autobot"], {}, body)).toEqual(["systemview-test", "autobot"]);
    expect(lastReplyAuthorOf(body)).toBe("autobot");
  });
});
