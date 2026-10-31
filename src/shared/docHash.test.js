const { AUDIENCE_KEYS, bodyOf, hashOf, stripAudience } = require("./docHash");

// WHAT EACH SPEC IS DOING. The claim is his rule: an update is owed when the document's CONTENT
// moves — prose edited, a reply added, a block created — and NEVER when a subscription moves.
// These are the specs that hold it, and they are deliberately about blocks the rule was not
// written for, because a rule that only works on threads is the rule that already failed.

const DOC = [
  "# a meeting",
  "",
  "::members{who=me|you sent=me:abc}",
  "",
  "prose nobody has argued with yet",
  "",
  "::::thread{id=t1 subscribe=me|you sent=me:111}",
  "an argument",
  "::::",
  "",
  ":::approval{ask=\"Approve this?\" subscribe=you}",
  "what approving commits to",
  ":::",
].join("\n");

describe("a subscription moving is not a change to the document", () => {
  const base = hashOf(DOC);

  it("taking somebody OFF a thread leaves the document's hash where it was", () => {
    // THE BUG, exactly: he removed autobot from a thread's audience and every DOCUMENT member went
    // behind — so the file offered an update for an argument nobody had touched.
    const next = DOC.replace("subscribe=me|you sent=me:111", "subscribe=me sent=me:111");
    expect(hashOf(next)).toBe(base);
  });

  it("nor does being TOLD — the stamp must not be its own change", () => {
    expect(hashOf(DOC.replace("sent=me:111", "sent=me:111|you:222"))).toBe(base);
    expect(hashOf(DOC.replace("sent=me:abc", "sent=me:abc|you:zzz"))).toBe(base);
  });

  it("nor an audience on a block that is not a thread — approvals carry one too", () => {
    // Subscriptions are universal: `subscribe=` already names an audience on ::commit, :::cmd,
    // ::run, ::test, ::branch and :::approval. A rule written per block is wrong about the next one.
    expect(hashOf(DOC.replace("subscribe=you}", "subscribe=you|me}"))).toBe(base);
  });

  it("nor turning auto on, nor the whole `::members` line appearing", () => {
    expect(hashOf(DOC.replace("sent=me:abc}", "sent=me:abc auto=you}"))).toBe(base);
    const none = DOC.split("\n").filter((l) => !l.startsWith("::members")).join("\n");
    // the line goes entirely, so a document GAINING membership has not changed either
    expect(hashOf(none)).toBe(base);
  });

  it("and the legacy spelling counts as the same attribute", () => {
    expect(AUDIENCE_KEYS).toEqual(["subscribe", "members", "who"]);
    expect(hashOf(DOC.replace("subscribe=me|you sent", "members=me|you sent"))).toBe(base);
  });
});

describe("content moving IS a change — the other half, or the feature says nothing", () => {
  const base = hashOf(DOC);

  it("a word of prose", () => {
    expect(hashOf(DOC.replace("nobody has argued with yet", "somebody has argued with"))).not.toBe(base);
  });

  it("a reply landing in a thread", () => {
    expect(hashOf(DOC.replace("an argument", "an argument\n:::reply{author=you}\nno\n:::"))).not.toBe(base);
  });

  it("a NEW thread — created is not the same as re-addressed", () => {
    expect(hashOf(`${DOC}\n\n::::thread{id=t2 subscribe=me}\n::::`)).not.toBe(base);
  });

  it("every OTHER attribute on a directive line still counts", () => {
    // The hub used to drop a thread opener's whole brace, so `id=` was all that survived and any
    // attribute added later would have stopped counting silently.
    expect(hashOf(DOC.replace("id=t1", "id=renamed"))).not.toBe(base);
    expect(hashOf(DOC.replace('ask="Approve this?"', 'ask="Approve something else?"'))).not.toBe(base);
  });
});

describe("the tokenizer, because a regex reaches into quoted prose", () => {
  it("`sent=` inside a quoted value is PROSE, not an attribute", () => {
    // Measured once on a claim whose note said "told= is the baseline": a naive scan wrote the
    // stamp into the note. The hash makes the same mistake in the other direction — it would stop
    // noticing an edit to that note.
    const a = '::claim[x]{id=c1 note="sent=me:1 is the baseline"}';
    const b = '::claim[x]{id=c1 note="sent=me:2 is the baseline"}';
    expect(hashOf(a)).not.toBe(hashOf(b));
  });

  it("a label quoting a block is left alone — the bag is the braces at the END", () => {
    const row = "::claim[Write `::rfc{subscribe=nobody}` into the file]{id=c8}";
    expect(stripAudience(row)).toBe(row);
  });

  it("prose that merely looks like an attribute is not touched", () => {
    expect(stripAudience("the value sent=me:abc appears in this sentence")).toBe(
      "the value sent=me:abc appears in this sentence",
    );
  });

  it("stripping the last attribute leaves the braces, not a bare directive", () => {
    // `::::thread{id=t}` and `::::thread` must not hash alike — the brace pair is part of the line.
    expect(stripAudience("::::thread{subscribe=me}")).toBe("::::thread{}");
    expect(bodyOf("::::thread{subscribe=me}")).not.toBe("::::thread");
  });
});
