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
  assert.deepEqual(r.ids, [1000, 2000, 3000]);
  assert.equal(read().length, 3, "nothing was removed");
});

test("an unknown id removes nothing and lists the ids that exist", async () => {
  const { api, read } = fake();
  const r = await api({ projectCode: "p", remove: 999999999999, as: "systemview-test" });
  assert.match(r.error, /no card with id/);
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
