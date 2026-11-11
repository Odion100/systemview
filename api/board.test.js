// THE BOARD'S REMOVAL RULE. `boardOn` is pure given a file layer, so the whole thing is claimable
// with two functions and no server.
//
// Why these claims and not others: deletion was chosen over a `done` state on 2026-10-14, and the
// two things that make deletion safe are the only two things worth proving — it addresses by ID and
// never by position, and it hands the removed text back so the act cannot be the last place the
// card existed.
const assert = require("node:assert");
const { test } = require("node:test");
const { boardOn, parseBoard, serializeBoard } = require("./board");

const CARDS = [
  { ts: 1000, by: "systemview-test", text: "first card" },
  { ts: 2000, by: "you", text: "second card" },
  { ts: 3000, by: "systemview-test", text: "third card", replies: [{ by: "you", ts: 3100, text: "a reply" }] },
];

function fake(cards = CARDS) {
  const disk = { content: serializeBoard({ title: "b", cards }) };
  const api = boardOn({
    readFile: async () => ({ ok: true, content: disk.content }),
    writeFile: async (_pc, { content }) => ((disk.content = content), { ok: true }),
  });
  return { api, disk, read: () => parseBoard(disk.content).cards };
}

test("removing a card by id takes it off and leaves the rest", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", remove: 2000, as: "systemview-test" });
  assert.equal(r.ok, true);
  assert.equal(r.removed, 2000);
  assert.deepEqual(read().map((c) => c.ts), [1000, 3000]);
});

test("the removed text comes back WHOLE — a deletion is never the last copy", async () => {
  const { api } = fake();
  const r = await api({ projectCode: "p", remove: 3000, as: "systemview-test" });
  assert.equal(r.text, "third card");
  assert.equal(r.replies, 1); // and it says the card was carrying a conversation
});

test("it answers with how many are left, which is the count the board shows", async () => {
  const { api } = fake();
  const r = await api({ projectCode: "p", remove: 1000, as: "systemview-test" });
  assert.equal(r.open, 2);
});

test("a POSITION is refused, and the refusal says why — unlike reply, which tolerates one", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", remove: 2, as: "systemview-test" });
  assert.equal(r.ok, undefined);
  assert.match(r.error, /positions shift/i);
  // The list comes back as {ts, title?} rather than bare numbers — a caller choosing between
  // three timestamps is choosing blind, and the title is the half he can actually read.
  assert.deepEqual(r.ids, [{ ts: 1000 }, { ts: 2000 }, { ts: 3000 }]);
  assert.equal(read().length, 3, "nothing was removed");
});

test("an unknown id removes nothing and lists the ids that exist", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", remove: 999999999999, as: "systemview-test" });
  assert.match(r.error, /nothing on the board has the id or title/);
  assert.equal(read().length, 3);
});

test("a removal must be signed, like every other write to his board", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", remove: 1000 });
  assert.match(r.error, /say who you are/);
  assert.equal(read().length, 3);
});

test("an empty remove is a refusal, not a no-op that reads as success", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", remove: "  ", as: "systemview-test" });
  assert.match(r.error, /which card/);
  assert.equal(read().length, 3);
});

test("removing does not disturb the title or the surviving replies", async () => {
  const { api, disk } = fake();
  await api({ projectCode: "p", remove: 1000, as: "systemview-test" });
  const after = parseBoard(disk.content);
  assert.equal(after.title, "b");
  assert.equal(after.cards.find((c) => c.ts === 3000).replies.length, 1);
});

// THE STATUS — the account on the card. His ask, 2026-10-16: *"it could be saying implemented, it
// could tell me what you did in one status, and whether it's done. Then I could come, see what it is
// and delete all of them."* So the claims below are about exactly two promises: a card can carry one
// readable account, and the settled ones go in a single motion that hands every text back.
test("a status lands on the card, signed and stamped", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", at: 2000, status: "resolved — the band is tabs now", as: "systemview-test" });
  assert.equal(r.ok, true);
  assert.equal(r.card, 2000);
  const card = read().find((c) => c.ts === 2000);
  assert.equal(card.status.text, "resolved — the band is tabs now");
  assert.equal(card.status.by, "systemview-test");
  assert.ok(card.status.ts > 0);
});

test("a second status REPLACES the first and says what it replaced", async () => {
  const { api, read } = fake();
  await api({ projectCode: "p", at: 1000, status: "started", as: "systemview-test" });
  const r = await api({ projectCode: "p", at: 1000, status: "resolved", as: "systemview-test" });
  assert.equal(r.replaced, "started");
  assert.equal(read().find((c) => c.ts === 1000).status.text, "resolved");
});

test("an empty status CLEARS it without touching the card", async () => {
  const { api, read } = fake();
  await api({ projectCode: "p", at: 1000, status: "wrong call", as: "systemview-test" });
  const r = await api({ projectCode: "p", at: 1000, status: "", as: "systemview-test" });
  assert.equal(r.status, null);
  const card = read().find((c) => c.ts === 1000);
  assert.equal(card.status, undefined);
  assert.equal(card.text, "first card"); // the card itself is untouched
});

test("a status never lands on a POSITION — positions shift when anyone adds a note", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", at: 2, status: "resolved", as: "systemview-test" });
  assert.match(r.error, /POSITION/);
  assert.deepEqual(read().filter((c) => c.status).length, 0);
});

test("a status is signed by its writer, like every other write here", async () => {
  const { api } = fake();
  const r = await api({ projectCode: "p", at: 1000, status: "resolved" });
  assert.match(r.error, /say who you are/);
});

test("a card's own words and its conversation survive a status", async () => {
  const { api, read } = fake();
  await api({ projectCode: "p", at: 3000, status: "resolved — lane stands", as: "systemview-test" });
  const card = read().find((c) => c.ts === 3000);
  assert.equal(card.text, "third card");
  assert.deepEqual(card.replies.map((r) => r.text), ["a reply"]);
});

test("clearing the settled ones takes exactly those, and hands every text back", async () => {
  const { api, read } = fake();
  await api({ projectCode: "p", at: 1000, status: "resolved", as: "systemview-test" });
  await api({ projectCode: "p", at: 3000, status: "resolved — cause in the gap file", as: "systemview-test" });
  const r = await api({ projectCode: "p", removeSettled: true, as: "systemview-test" });
  assert.equal(r.removed, 2);
  assert.equal(r.open, 1);
  assert.deepEqual(r.cleared.map((c) => c.text), ["first card", "third card"]);
  assert.deepEqual(r.cleared.map((c) => c.status), ["resolved", "resolved — cause in the gap file"]);
  assert.deepEqual(read().map((c) => c.ts), [2000]);
});

test("nothing settled is removed: 0 with the count it looked at, not a refusal", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", removeSettled: true, as: "systemview-test" });
  assert.equal(r.ok, true);
  assert.equal(r.removed, 0);
  assert.equal(r.open, 3);
  assert.equal(read().length, 3);
});

test("the format round-trips a status byte for byte, and two statuses collapse to the last", () => {
  const file =
    "<!--card 7 by=me-->\nthe card\n<!--status by=me ts=9-->\nresolved — a < b\n<!--reply by=you ts=5-->\na reply\n";
  const parsed = parseBoard(file);
  assert.equal(parsed.cards[0].status.text, "resolved — a < b");
  assert.deepEqual(parsed.cards[0].replies.map((r) => r.text), ["a reply"]);
  assert.equal(serializeBoard(parsed), file);
  assert.equal(parseBoard("<!--card 8-->\nc\n<!--status ts=1-->\nold\n<!--status ts=2-->\nnew\n").cards[0].status.text, "new");
});

// THE HUB'S DOOR CARRIES EVERY PARAMETER THE CAPABILITY HAS — the bug this file could not see.
// `boardOn` had `status` and `removeSettled` with claims around both, and the Agent module's
// passthrough in api/index.js destructured only the parameters it knew about. So a status sent
// through the hub was dropped before it ever reached this module, fell through to the plain board
// read, and came back looking like a successful call with the card untouched. Nothing failed; the
// write simply never happened.
//
// A mock of the passthrough would have passed too, which is why this claim reads the REAL source:
// every parameter in board.js's signature must appear on both sides of index.js's board line.
// `reply` is the one deliberate rename (the MCP tool calls it `replyText`), so it is named here as
// an exception rather than left to a looser match that would hide the next drop.
test("api/index.js forwards every parameter boardOn accepts — no door stops at the hub", () => {
  const fs = require("node:fs");
  const boardSrc = fs.readFileSync(require.resolve("./board"), "utf8");
  const hubSrc = fs.readFileSync(require.resolve("./index"), "utf8");

  const sig = boardSrc.match(/return async function board\(\{([^}]*)\}/);
  assert.ok(sig, "could not find boardOn's returned signature — this claim needs updating, not deleting");
  const params = sig[1]
    .split(",")
    .map((s) => s.trim().split(/[:=]/)[0].trim())
    .filter(Boolean)
    // The rest element is not a parameter — it is the opposite, the catch-all that makes an
    // unrecognised one visible. It is claimed on its own below, where the claim can say which half
    // of the trip it has to survive.
    .filter((x) => !x.startsWith("..."));
  assert.ok(params.includes("status") && params.includes("removeSettled"), "the signature itself changed");

  // The passthrough is a function body now (it emits after a write), so the two halves are matched
  // separately rather than as one line — the claim is about PARAMETERS, not about its shape.
  const line = hubSrc.match(/board: async function boardVerb\(\{([^}]*)\}[\s\S]{0,400}?Board\(\{([^}]*)\}\)/);
  assert.ok(line, "could not find the Agent module's board passthrough in api/index.js");
  const [, takes, passes] = line;
  const RENAMED = { reply: "replyText" };
  for (const p of params) {
    const incoming = RENAMED[p] || p;
    assert.ok(new RegExp(`\\b${incoming}\\b`).test(takes), `the hub's board door does not accept "${incoming}"`);
    assert.ok(new RegExp(`\\b${p}\\b`).test(passes), `the hub's board door accepts but never forwards "${p}"`);
  }
});

// THE STATE ON AN ACCOUNT — what makes the board MANAGEABLE rather than merely annotated. His
// ruling, 2026-10-19, after reading one of my accounts back to me: a line of prose says nothing
// about whether the thing is finished, so the board still has to be read card by card, which is
// the cost the account existed to remove. The state leads the line and the free text follows it —
// both, never one instead of the other.
test("the state is read off the front of the account, and free text without one is still an account", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", at: 1000, status: "resolved — reports are a band tab now", as: "systemview-test" });
  assert.equal(r.state, "resolved");
  assert.equal(r.done, 1);
  const bare = await api({ projectCode: "p", at: 2000, status: "the agent door works end to end", as: "systemview-test" });
  assert.equal(bare.ok, true, "an account without a state is accepted — the state is additive, not a gate");
  assert.equal(bare.state, null);
  assert.equal(bare.settled, 2, "it still counts as an account");
  assert.equal(bare.done, 1, "but it is not FINISHED, because nothing in it says so");
  assert.equal(read()[0].status.state, "resolved");
  assert.equal(read()[1].status.state, null);
});

test("a clear runs on the state: the finished ones go, an account that says otherwise stays", async () => {
  const { api, read } = fake();
  await api({ projectCode: "p", at: 1000, status: "resolved — landed in 41fb11a", as: "systemview-test" });
  await api({ projectCode: "p", at: 2000, status: "partial — the panel half only", as: "systemview-test" });
  await api({ projectCode: "p", at: 3000, status: "resolved — cause written into the gap file", as: "systemview-test" });
  const r = await api({ projectCode: "p", removeSettled: true, as: "systemview-test" });
  assert.equal(r.removed, 2);
  assert.deepEqual(r.cleared.map((c) => c.state), ["resolved", "resolved"]);
  assert.equal(r.took, "resolved");
  // The card that said work was outstanding is the one that had to survive the press.
  assert.deepEqual(read().map((c) => c.ts), [2000]);
  assert.deepEqual(r.stillSettled, { partial: 1 });
});

test("a clear can name one state, and an unknown state is refused with the vocabulary", async () => {
  const { api, read } = fake();
  await api({ projectCode: "p", at: 1000, status: "blocked — waiting on the autobot door", as: "systemview-test" });
  await api({ projectCode: "p", at: 2000, status: "resolved — done", as: "systemview-test" });
  const r = await api({ projectCode: "p", removeSettled: "blocked", as: "systemview-test" });
  assert.equal(r.removed, 1);
  assert.equal(r.took, "blocked");
  assert.deepEqual(read().map((c) => c.ts), [2000, 3000]);
  const bad = await api({ projectCode: "p", removeSettled: "done", as: "systemview-test" });
  assert.match(bad.error, /no state "done"/);
  assert.deepEqual(bad.states, ["resolved", "reviewed", "partial", "blocked"]);
});

test("a stateless account is never swept by a clear — it is unmanaged, not finished", async () => {
  const { api, read } = fake();
  await api({ projectCode: "p", at: 1000, status: "I did the thing and it works", as: "systemview-test" });
  const r = await api({ projectCode: "p", removeSettled: true, as: "systemview-test" });
  assert.equal(r.removed, 0);
  assert.deepEqual(r.stillSettled, { "no state": 1 });
  assert.equal(read().length, 3);
});

// ── ADDRESSING A CARD: ID, TITLE, OR PART OF ONE ──────────────────────────────────────────────
// His ask, 2026-10-19 — a card had no NAME, so "I'm talking about this note" had nothing on the
// other side to resolve to. The title is a real field on the stamp, and every door that aims at a
// card takes it.
const TITLED = [
  { ts: 1000, by: "systemview-test", title: "the status picker", text: "first card" },
  { ts: 2000, by: "you", title: "chat rooms follow the cwd", text: "second card" },
  { ts: 3000, by: "systemview-test", title: "the picker's sibling", text: "third card" },
];

test("a card is addressed by its id, its exact title, or an unambiguous part of one", async () => {
  const { api, read } = fake(TITLED);
  assert.equal((await api({ projectCode: "p", at: "the status picker", status: "resolved — done", as: "me" })).card, 1000);
  assert.equal((await api({ projectCode: "p", at: "THE STATUS PICKER", status: "resolved — case does not matter", as: "me" })).card, 1000);
  assert.equal((await api({ projectCode: "p", at: "cwd", status: "blocked — your call", as: "me" })).card, 2000);
  assert.equal((await api({ projectCode: "p", at: 3000, status: "partial — half", as: "me" })).card, 3000);
  assert.equal(read()[0].status.state, "resolved");
});

test("an exact title wins over a substring, so a card can never be shadowed by a longer one", async () => {
  const { api } = fake([...TITLED, { ts: 4000, by: "me", title: "picker", text: "fourth" }]);
  const r = await api({ projectCode: "p", at: "picker", status: "resolved — the exact one", as: "me" });
  assert.equal(r.card, 4000, "`picker` is a whole title, so it is that card and not the two containing it");
});

test("an ambiguous title is REFUSED and names the candidates — never resolved to the first hit", async () => {
  const { api, read } = fake(TITLED);
  const r = await api({ projectCode: "p", at: "picker", status: "resolved — which one?", as: "me" });
  assert.match(r.error, /matches 2 cards/);
  assert.deepEqual(r.matches.map((m) => m.ts), [1000, 3000]);
  assert.ok(read().every((c) => !c.status), "nothing was stamped while it was ambiguous");
});

test("a removal takes a title too, and the title survives the file round trip", async () => {
  const { api, read } = fake(TITLED);
  const r = await api({ projectCode: "p", remove: "chat rooms follow the cwd", as: "me" });
  assert.equal(r.removed, 2000);
  assert.deepEqual(read().map((c) => c.title), ["the status picker", "the picker's sibling"]);
});

test("a new card can be titled, and a title with spaces round-trips through the stamp", () => {
  const file = serializeBoard({ title: "", cards: [{ ts: 7, by: "me", title: "a title with spaces", text: "body" }] });
  assert.match(file, /<!--card 7 by=me title="a title with spaces"-->/);
  assert.equal(parseBoard(file).cards[0].title, "a title with spaces");
  assert.equal(serializeBoard(parseBoard(file)), file);
  // A card with no title is byte-identical to what it has always been — nothing on disk moves.
  assert.equal(serializeBoard({ title: "", cards: [{ ts: 8, by: "me", text: "b" }] }), "<!--card 8 by=me-->\nb\n");
});

test("reading one state answers only those, and says how many cards it looked at", async () => {
  const { api } = fake(TITLED);
  await api({ projectCode: "p", at: 1000, status: "resolved — landed", as: "me" });
  const done = await api({ projectCode: "p", state: "resolved" });
  assert.deepEqual(done.cards.map((c) => c.ts), [1000]);
  assert.equal(done.of, 3);
  const open = await api({ projectCode: "p", state: "open" });
  assert.deepEqual(open.cards.map((c) => c.ts), [2000, 3000], "`open` is the cards with no account at all");
  const bad = await api({ projectCode: "p", state: "done" });
  assert.match(bad.error, /no state "done"/);
});

test("a card already on the board can be named, renamed, and un-named", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", at: 1000, title: "the status picker", as: "me" });
  assert.equal(r.ok, true);
  assert.equal(r.title, "the status picker");
  assert.equal(read()[0].title, "the status picker");
  // Once named, the name is an address — this is the whole point of the field.
  assert.equal((await api({ projectCode: "p", at: "status picker", title: "the picker", as: "me" })).was, "the status picker");
  assert.equal((await api({ projectCode: "p", at: 1000, title: "", as: "me" })).title, null);
  assert.ok(!("title" in read()[0]));
});

// `reviewed` IS STAMPED, NOT DERIVED — the correction that ended the derived version: *"how can I
// derive that you actually reviewed it?"* A title proves a title was typed; only the stamp proves
// the card was read. So `open` means no account at all, and nothing else is inferred.
test("`open` is an absence and `reviewed` is a claim — a title alone changes neither", async () => {
  const CARDS = [
    { ts: 1000, by: "", text: "a voice dump" },
    { ts: 2000, by: "systemview-test", text: "an agent's card" },
  ];
  const { api } = fake(CARDS);
  await api({ projectCode: "p", at: 1000, title: "the post-commit hook he wants", as: "systemview-test" });
  assert.deepEqual(
    (await api({ projectCode: "p", state: "open" })).cards.map((c) => c.ts),
    [1000, 2000],
    "titling it did NOT make it reviewed — it is still an absence",
  );
  const r = await api({ projectCode: "p", at: "post-commit", status: "reviewed — he wants a per-project post-commit hook", as: "systemview-test" });
  assert.equal(r.state, "reviewed");
  assert.equal(r.done, 0, "reviewed is not finished and a clear must never take it");
  assert.deepEqual((await api({ projectCode: "p", state: "reviewed" })).cards.map((c) => c.ts), [1000]);
  assert.deepEqual((await api({ projectCode: "p", state: "open" })).cards.map((c) => c.ts), [2000]);
});

// WHAT THE WORK ON A CARD OWES, DECLARED BEFORE ANYBODY DOES IT.
//
// His design, 2026-11-02. An agent asked at the END whether its own work needed proving is the
// party with an interest and will say no — the same self-interest `rfc-authoring` handles by
// forcing `kind=experiential` to be declared at authoring time. So the declaration lives on the
// card, from before the work started, and `proactive-development` READS it instead of deciding.
test("report= rides the card's stamp and survives a round trip", () => {
  const src = `<!--card 1 by=odion title="the status picker" report=spec-->\nsomething to build\n`;
  const { cards } = parseBoard(src);
  assert.strictEqual(cards[0].report, "spec");
  // The round trip is the claim that matters: a field that parses and does not serialize is a
  // field that silently disappears the next time anybody writes the board.
  assert.strictEqual(serializeBoard({ title: "", cards }), src);
});

test("a card with no report= is not given one — undeclared has to stay expressible", () => {
  const { cards } = parseBoard(`<!--card 1 by=odion-->\nraw from the recorder\n`);
  assert.strictEqual("report" in cards[0], false);
  // THE REASON IT IS NOT REQUIRED: his own cards arrive from a voice recorder with nothing on
  // them, so a required field would refuse every one. Absent means nobody has decided, which is
  // exactly what context-maintenance's board pass sweeps for.
  assert.strictEqual(serializeBoard({ title: "", cards }).includes("report="), false);
});

test("title and report both ride the same stamp without eating each other", () => {
  const src = `<!--card 7 by=a title="two words here" report=account-->\nbody\n`;
  const { cards } = parseBoard(src);
  assert.strictEqual(cards[0].title, "two words here");
  assert.strictEqual(cards[0].report, "account");
  assert.strictEqual(serializeBoard({ title: "", cards }), src);
});

// AN UNRECOGNISED PARAMETER HAS TO SURVIVE THE TRIP TO BE REFUSED. Both halves are needed and
// either alone is the old silent read: board.js can only name what reached it, and the hub route
// destructured the names it knew and dropped the rest on the floor. That is where `report=` died
// against the older hub — the route dropped it, the read fell through, and 125 cards came back
// looking like a write that had happened.
test("the hub route FORWARDS what it does not recognise, so the vocabulary is policed in one place", () => {
  const fs = require("node:fs");
  const hubSrc = fs.readFileSync(require.resolve("./index"), "utf8");
  const line = hubSrc.match(/board: async function boardVerb\(\{([^}]*)\}[\s\S]{0,400}?Board\(\{([^}]*)\}\)/);
  assert.ok(line, "could not find the Agent module's board passthrough in api/index.js");
  const [, takes, passes] = line;
  assert.match(takes, /\.\.\.rest/, "the route must COLLECT the parameters it does not know");
  assert.match(passes, /\.\.\.rest/, "and pass them on, or board.js has nothing to refuse");
});

// ── READING LESS THAN EVERYTHING ──────────────────────────────────────────────────────────────
// WHY THESE EXIST. A proactive run read the 30 open cards to choose one piece of work, spent about
// 12k tokens on it, and the answer TRUNCATED mid-card — so the last cards were not just expensive,
// they were unreadable, and the pick was made from a partial board. The door had no smaller question
// in it: every call that was not a recognised write answered with all of them.
//
// The three claims below are the three smaller questions, and the last one is the reason the first
// two were reachable at all — `at` with no write used to BE the full read.
const MIXED = [
  { ts: 1000, by: "him", text: "x".repeat(900), title: "a titled card", report: "spec", status: { by: "me", ts: 1, text: "partial — half of it", state: "partial" } },
  { ts: 2000, by: "him", text: "an untitled card he dropped in by voice, raw" },
  { ts: 3000, by: "him", text: "y".repeat(400), title: "another titled card", replies: [{ by: "me", ts: 2, text: "a reply" }] },
];

test("`brief` hands back the index and NOT the bodies — what a reader needs to choose one", async () => {
  const { api } = fake(MIXED);
  const r = await api({ projectCode: "p", brief: true });
  assert.equal(r.of, 3);
  assert.equal(r.cards, undefined, "the bodies are the cost — they must not come back");
  assert.deepEqual(r.brief.map((b) => b.ts), [1000, 2000, 3000]);
  // Addressable, readable, and it says how much body is waiting if the reader wants it.
  assert.deepEqual(r.brief[0], { ts: 1000, title: "a titled card", state: "partial", report: "spec", chars: 900 });
  assert.equal(r.brief[2].replies, 1);
  // The whole point, in one number: the index is a fraction of the bodies it stands for.
  assert.ok(JSON.stringify(r.brief).length < 900, "an index longer than one card's body buys nothing");
});

test("an untitled card is still nameable, and says nobody has titled it", async () => {
  const { api } = fake(MIXED);
  const { brief } = await api({ projectCode: "p", brief: true });
  assert.equal(brief[1].title, "an untitled card he dropped in by voice, raw");
  assert.equal(brief[1].untitled, true, "inferring a title would hide that no reviewer has been near it");
  assert.equal(brief[1].state, "open", "no account at all is `open`, derived from the absence");
});

test("`brief` narrows a state read too, because that is the read a picker actually makes", async () => {
  const { api } = fake(MIXED);
  const r = await api({ projectCode: "p", state: "open", brief: true });
  assert.equal(r.state, "open");
  assert.deepEqual(r.brief.map((b) => b.ts), [2000, 3000]);
  assert.equal(r.cards, undefined);
});

test("`at` with no write reads THAT card — it used to answer with the whole board", async () => {
  const { api } = fake(MIXED);
  const r = await api({ projectCode: "p", at: "another titled" });
  assert.equal(r.how, "part of the title", "addressed the same way every write addresses one");
  assert.equal(r.card.ts, 3000);
  assert.equal(r.card.text, "y".repeat(400), "one card comes back WHOLE — that is what asking for one is for");
  assert.equal(r.cards, undefined);
  assert.equal(r.of, 3, "and it still says how many it chose from");
});

test("an unreachable `at` is refused with the candidates, never answered with everything", async () => {
  const { api } = fake(MIXED);
  const r = await api({ projectCode: "p", at: "titled card" });
  assert.match(r.error, /two cards|more than one|matches/i);
  assert.equal(r.card, undefined);
  assert.equal(r.cards, undefined, "the old fallthrough answered an ambiguous address with all 125");
});

// ── THE PARAMETER THIS DOOR DOES NOT KNOW ─────────────────────────────────────────────────────
// Measured: a call carrying `report=` against a hub that had not restarted yet came back with the
// whole board and no error, so the caller could not tell the write had never happened. A refusal is
// the only answer that is distinguishable from a read.
test("a parameter this door does not understand is refused BY NAME, and nothing is written", async () => {
  const { api, read } = fake(MIXED);
  const r = await api({ projectCode: "p", at: 1000, repott: "spec", as: "me" });
  assert.match(r.error, /does not understand "repott"/);
  assert.match(r.error, /nothing was read or written/);
  assert.ok(r.understands.includes("report"), "it hands back the vocabulary, so the typo is fixable in one read");
  assert.ok(r.understands.includes("brief"));
  assert.deepEqual(read().map((c) => c.ts), [1000, 2000, 3000], "and the board is untouched");
});

test("an explicitly undefined parameter is not a refusal — that is how a caller spreads options", async () => {
  const { api } = fake(MIXED);
  const r = await api({ projectCode: "p", brief: true, somethingOptional: undefined });
  assert.equal(r.error, undefined);
  assert.equal(r.of, 3);
});

// THREE WRITES IN ONE CALL ALL LAND — the regression that produced this test.
//
// `report`, `title` and `status` were three `if (…) { … return }` blocks in that order, so a call
// carrying a status AND a declaration took the declaration, answered `ok: true`, and dropped the
// status. Measured 2026-11-10 during a board pass: three cards in a row got their `report` and not
// one got the line meant to justify it, and every answer said ok. A write that does not happen and
// reports success is undetectable from the outside, which is why this is asserted on the DISK and
// not on the answer — an answer can agree with itself.
test("a status, a declaration and a title in ONE call all land — none is silently dropped", async () => {
  const { api, read } = fake();
  const r = await api({
    projectCode: "p",
    at: 1000,
    title: "the first card, named",
    report: "spec",
    status: "reviewed — read it and it is still real",
    as: "me",
  });
  assert.equal(r.ok, true);

  // THE DISK, not the answer.
  const card = read()[0];
  assert.equal(card.title, "the first card, named", "the title landed");
  assert.equal(card.report, "spec", "the declaration landed");
  assert.equal(card.status.text, "reviewed — read it and it is still real", "the account landed");
  assert.equal(card.status.state, "reviewed", "and its state was still read off the text");

  // The answer says all three happened, so a caller can tell.
  assert.equal(r.title, "the first card, named");
  assert.equal(r.report, "spec");
  assert.equal(r.status, "reviewed — read it and it is still real");
  assert.equal(r.state, "reviewed");
  // And the two counts still ride along when an account was touched.
  assert.equal(typeof r.settled, "number");
  assert.equal(typeof r.done, "number");
});

// ONE WRITE, NOT THREE. The board file is read-modify-written whole, so serializing once per field
// would be three chances for a lost update on a file two processes already share.
test("three fields in one call serialize the board exactly once", async () => {
  const disk = { content: serializeBoard({ title: "b", cards: CARDS }), writes: 0 };
  const api = boardOn({
    readFile: async () => ({ ok: true, content: disk.content }),
    writeFile: async (_pc, { content }) => ((disk.content = content), (disk.writes += 1), { ok: true }),
  });
  await api({ projectCode: "p", at: 1000, title: "named", report: "audit", status: "partial — half", as: "me" });
  assert.equal(disk.writes, 1, "one write for three fields");
});

// EACH ONE STILL WORKS ALONE, with the answer shape it always had.
test("a declaration, a title or a status on its own is unchanged by composing", async () => {
  const a = await fake().api({ projectCode: "p", at: 1000, report: "brief", as: "me" });
  assert.equal(a.report, "brief");
  assert.equal(a.was, "", "report-only still answers `was`, so an older reader keeps its meaning");

  const b = await fake().api({ projectCode: "p", at: 1000, status: "resolved — done", as: "me" });
  assert.equal(b.state, "resolved");
  assert.equal(b.done, 1, "`done` counts what a bulk clear would take");
  assert.ok(!("report" in b), "a status-only call says nothing about a declaration");

  const c = await fake().api({ projectCode: "p", at: 1000, title: "just a name", as: "me" });
  assert.equal(c.title, "just a name");
  assert.ok(!("status" in c));
});
