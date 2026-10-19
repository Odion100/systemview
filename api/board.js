// THE BOARD, AS A HUB CAPABILITY — his surface, addressed by project.
//
// The parse/serialize pair is the format and belongs to nobody; the rest was a terminal program
// hunting a live service through HTTP for a folder the hub has always known. Found live before that
// hunt was fixed: `board --add` burned three connection timeouts against dead registrations and then
// refused to leave a note on a repo whose root was sitting in the registry.
const ROOT = ".systemview/boards";
const boardPath = (name) => `${ROOT}/${name || "board"}.md`;

// THE STATE IS THE FIRST WORD OF THE ACCOUNT — his ruling, 2026-10-19: *"the whole point of a
// status in the first place is things like being able to delete all the fucking implemented
// ones… it's about being able to MANAGE the shit."* A free-text account cannot be managed: the
// board still has to be read card by card to know what is finished, which is the cost the status
// existed to remove. So an account carries a state, and the state is what bulk deletion runs on.
//
// It is parsed from the line rather than stored as another attribute: `implemented — reports are a
// band tab now` is how he said it in the first place, it stays readable in the markdown, and there
// is no second place for the two to disagree.
// FOUR WORDS, AND EACH ONE IS A THING HE DOES NEXT — the test the vocabulary has to pass, from
// the way he actually reads the board (2026-10-19): *"if I see things are blocked, that means I
// probably need to respond. Open, and the day is old — why is this still open? Answered, I don't
// know what that means… there's no thing that shows things are RESOLVED, and I'm like, oh, let me
// look what's resolved, delete, delete, delete."*
//
//   open      nobody has started it          → his nudge, when it has sat too long
//   partial   started, half of it is real    → nothing for him to do
//   blocked   waiting on HIM                 → the only state that is a request
//   resolved  finished                       → read one line, delete it
//
// `implemented` and `answered` were two words for one of those: both mean "read it and delete it",
// and `answered` only parsed if you already knew the card had been a question — which is knowledge
// the reader should never need. The line beside the state says whether it was code or a cause
// written down; the state says it is over.
const STATES = ["resolved", "partial", "blocked"];
// DONE is narrower than "has a status", and that gap is the whole safety of a bulk delete: a
// `partial` or `blocked` card carries an account precisely because work is still outstanding on
// it, so clearing by "has an account" would delete exactly the cards that must survive.
const DONE = ["resolved"];
// A HYPHEN IS NOT A SEPARATOR HERE: `implemented-ish, sort of` is not the word `implemented`,
// and reading it as one would file a hedge as finished. A spaced ` - ` still splits on the space.
const stateOf = (text) => {
  const first = String(text || "").trim().split(/[\s—:]/)[0].toLowerCase();
  return STATES.includes(first) ? first : null;
};

// The file is markdown: an optional `# title`, then cards separated by an invisible stamp comment.
// RFC-039 — A NOTE HOLDS A CONVERSATION. Replies used to be a single slot, so writing a second one
// erased the first; they are a list now, each stamped with who wrote it. `<!--reply-->` with no
// author is the old single form and still reads, as his.
function parseBoard(text) {
  const src = String(text || "");
  const head = src.split(/<!--card /)[0];
  const t = head.match(/^\s*#\s+(.+)\s*$/m);
  const cards = [];
  // THE TITLE IS A FIELD ON THE STAMP, not the first line of the prose. His call, 2026-10-19,
  // when we worked out that a card has no NAME: *"a real field"* — because a convention that
  // reads a title out of the body means every card that opens with a sentence has a title nobody
  // chose, and the one thing a name has to be is deliberate. It rides in the comment so the file
  // still renders as plain notes anywhere else, and it is what lets him SAY which card he means.
  src.split(/<!--card (\d+)((?: [a-z]+=(?:"[^"]*"|[^\s>]+))*)-->/).forEach((part, i, arr) => {
    if (i % 3 !== 1) return;
    const attrs0 = String(arr[i + 1] || "");
    const who0 = (attrs0.match(/\bby=("[^"]*"|[^\s]+)/) || [])[1] || "";
    const title0 = (attrs0.match(/\btitle=("[^"]*"|[^\s]+)/) || [])[1] || "";
    const unquote = (v) => String(v || "").replace(/^"|"$/g, "");
    const chunk = String(arr[i + 2] || "");
    // ONE SPLIT THAT REMEMBERS WHICH COMMENT IT CUT AT. Splitting on `reply|status` without
    // capturing the kind meant telling a status from a reply by comparing their text afterwards —
    // which works until two of them say the same thing. The kind is in the delimiter; capture it.
    const bits = chunk.split(/<!--(reply|status)(?: ([^>]*?))?-->/);
    const replies = [];
    let status = null;
    for (let b = 1; b < bits.length; b += 3) {
      const kind = bits[b];
      const attrs = String(bits[b + 1] || "");
      const body = String(bits[b + 2] || "").trim();
      if (!body) continue;
      const at = {
        by: (attrs.match(/by=([^\s]+)/) || [])[1] || "",
        ts: Number((attrs.match(/ts=(\d+)/) || [])[1]) || 0,
        text: body,
        ...(kind === "status" ? { state: stateOf(body) } : {}),
      };
      // A STATUS IS ONE SLOT, NOT A LIST — the opposite of replies, on purpose. A reply is a turn in
      // a conversation and losing one loses what somebody said; a status is the card's CURRENT
      // account ("implemented — reports are a band tab now"), so the newest is the only one that is
      // true, and a history of accounts is exactly the re-read this surface exists to kill. A file
      // carrying two takes the LAST, which is the same rule the writer follows.
      if (kind === "status") status = at;
      else replies.push(at);
    }
    cards.push({
      ts: Number(part),
      by: unquote(who0),
      ...(title0 ? { title: unquote(title0) } : {}),
      text: bits[0].trim(),
      replies,
      ...(status ? { status } : {}),
    });
  });
  return { title: t ? t[1].trim() : "", cards };
}

function serializeBoard({ title, cards }) {
  return `${title ? `# ${title}\n\n` : ""}${cards
    .map(
      (c) =>
        // A title with a space in it has to survive the round trip, so it is quoted; `by` never
        // has one and stays bare, which keeps every card already on disk byte-identical.
        `<!--card ${c.ts}${c.by ? ` by=${c.by}` : ""}${c.title ? ` title="${String(c.title).replace(/"/g, "'")}"` : ""}-->\n${c.text}\n` +
        // The status rides directly under the card's own words, above the conversation — it is the
        // card's account, and reading the file top-down should hand it over before the thread.
        (c.status && c.status.text
          ? `<!--status${c.status.by ? ` by=${c.status.by}` : ""}${c.status.ts ? ` ts=${c.status.ts}` : ""}-->\n${c.status.text}\n`
          : "") +
        (c.replies || [])
          .map((r) => `<!--reply${r.by ? ` by=${r.by}` : ""}${r.ts ? ` ts=${r.ts}` : ""}-->\n${r.text}\n`)
          .join("")
    )
    .join("\n")}`;
}


// HOW A CARD IS ADDRESSED — one resolver, used by every door that aims at one. His ask,
// 2026-10-19: *"just making sure the MCP can easily let you grab it by its title, its status, its
// ID, or whatever."*
//
// The ORDER is the safety. An id is exact and wins outright. A title is matched next — exactly
// first, then as a substring — and AMBIGUITY IS REFUSED rather than resolved to the first hit,
// because the one thing worse than not finding his card is confidently acting on a different one.
// A bare position is still refused everywhere, as it always was: positions shift when anyone adds
// a note, and `status` or `remove` on the wrong card is loss.
function addressCard(cards, want) {
  const q = String(want == null ? "" : want).trim();
  if (!q) return { error: "which card? pass its id, or its title" };
  const byId = cards.find((c) => String(c.ts) === q);
  if (byId) return { card: byId, how: "id" };
  const low = q.toLowerCase();
  const exact = cards.filter((c) => String(c.title || "").toLowerCase() === low);
  const hits = exact.length ? exact : cards.filter((c) => String(c.title || "").toLowerCase().includes(low));
  if (hits.length === 1) return { card: hits[0], how: exact.length ? "title" : "part of the title" };
  if (hits.length > 1)
    return {
      error: `"${q}" matches ${hits.length} cards — say which`,
      matches: hits.map((c) => ({ ts: c.ts, title: c.title || "" })),
    };
  return {
    error: /^\d{1,4}$/.test(q)
      ? `no card with id "${q}" — and a POSITION is never accepted, because positions shift when anyone adds a note. Pass the id or the title.`
      : `nothing on the board has the id or title "${q}" — ${cards.length} cards`,
    ids: cards.map((c) => ({ ts: c.ts, ...(c.title ? { title: c.title } : {}) })),
  };
}

function boardOn({ readFile, writeFile }) {
  async function load(projectCode, name) {
    const res = await readFile(projectCode, { path: boardPath(name) });
    // No board yet is the normal case, not an error.
    return res && res.ok !== false ? parseBoard(res.content) : { title: "", cards: [] };
  }

  return async function board({ projectCode, name, add, reply, remove, removeSettled, status, state, title, at, as } = {}) {
    if (!projectCode) return { error: "projectCode required" };
    // AN UNKNOWN PROJECT IS NOT AN EMPTY BOARD. Reading straight through answered `cards: []` for a
    // project the hub has never heard of — the same silent shrug as "no tests to run" standing in
    // for "nothing was ever asked". The file layer already knows the difference; ask it.
    const probe = await readFile(projectCode, { path: boardPath(name) });
    if (probe && probe.ok === false && /no folder for this project/i.test(probe.error || ""))
      return { error: `no connected project "${projectCode}"` };
    const board = await load(projectCode, name);
    const where = { project: projectCode, board: name || "board" };

    // WHO WROTE IT IS SAID BY THE WRITER. Any agent can write on any board, and nothing in this
    // path can tell who is calling — so a missing signature cannot default to anything. "agent"
    // meant nobody, and defaulting to the board's OWNER would stamp a visitor's answer as his.
    if (add != null || reply != null || remove != null || status != null || removeSettled) {
      if (!as) return { ...where, error: "say who you are — every note, reply, status and removal is signed by its writer" };
    }

    if (add != null) {
      const text = String(add).trim();
      if (!text) return { ...where, error: "a note needs something to say" };
      board.cards = [{ ts: Date.now(), by: as, ...(title ? { title: String(title).trim() } : {}), text }, ...board.cards];
      const w = await writeFile(projectCode, { path: boardPath(name), content: serializeBoard(board) });
      if (!w || w.ok === false) return { ...where, error: (w && w.error) || "could not write the board" };
      return { ...where, ok: true, added: board.cards[0].ts, ...(title ? { title: board.cards[0].title } : {}), by: as };
    }

    // NAMING A CARD THAT ALREADY EXISTS. `title` with `add` names a new card; `title` with `at`
    // names one that is already on the board — which is most of them, since the field arrived
    // after 28 cards did. An empty string takes the name off, the same shape as clearing a status.
    if (title != null && add == null) {
      const found = addressCard(board.cards, at);
      if (found.error) return { ...where, ...found };
      const card = found.card;
      const was = card.title || "";
      const next = String(title).trim();
      if (next) card.title = next;
      else delete card.title;
      const w = await writeFile(projectCode, { path: boardPath(name), content: serializeBoard(board) });
      if (!w || w.ok === false) return { ...where, error: (w && w.error) || "could not write the board" };
      return { ...where, ok: true, card: card.ts, title: next || null, ...(was && was !== next ? { was } : {}), by: as };
    }

    // THE ACCOUNT, ON THE CARD — his ask, 2026-10-16: *"it could be saying implemented, it could
    // tell me what you did in one status, and whether it's done. Then I could come, see what it is
    // and delete all of them."* So a status is not a lifecycle state to filter by; it is one line
    // saying what happened, written where he is already looking, so a deletion needs no re-read of
    // the card and no trip to a report.
    //
    // It does NOT make a card survive. His 2026-10-14 ruling stands below — cards are deleted, and
    // the count stays equal to the outstanding count. The status is what makes deleting SAFE to do
    // in a batch, which is the whole of what he asked for.
    //
    // ONE SLOT, OVERWRITTEN. A second status replaces the first: the card's account is whatever is
    // true now, and a card with a history of accounts is the re-read this surface exists to kill.
    // An empty string CLEARS it — a status written in error must be removable without deleting the
    // card it is attached to.
    if (status != null) {
      const found = addressCard(board.cards, at);
      if (found.error) return { ...where, ...found };
      const card = found.card;
      const text = String(status).trim();
      // THE STATE RIDES WITH THE FREE TEXT — it never replaces it. His ruling, 2026-10-19: *"the
      // status can come with some free text, probably should"* — so leading with a state word is
      // what makes the board manageable (scan it, group it, clear the finished ones without
      // reading a line), and the line after it is what makes the card followable-up without
      // redoing the work. An account with no state is still an account; it simply cannot be
      // managed by anything but a human eye, which is what the grey mark says on the card.
      const state = text ? stateOf(text) : null;
      const had = card.status ? card.status.text : "";
      if (text) card.status = { by: as, ts: Date.now(), text, state };
      else delete card.status;
      const w = await writeFile(projectCode, { path: boardPath(name), content: serializeBoard(board) });
      if (!w || w.ok === false) return { ...where, error: (w && w.error) || "could not write the board" };
      return {
        ...where,
        ok: true,
        card: card.ts,
        by: as,
        status: text || null,
        state,
        ...(had && had !== text ? { replaced: had } : {}),
        // Both numbers, because they answer different questions and the gap between them is the
        // point: `settled` is how many carry an account, `done` is how many a bulk clear would take.
        settled: board.cards.filter((c) => c.status && c.status.text).length,
        done: board.cards.filter((c) => c.status && DONE.includes(c.status.state)).length,
      };
    }

    // CLEARING THE SETTLED ONES IN ONE MOTION — the second half of his ask (*"then I could come,
    // see what it is and delete all of them"*). Every card carrying a status goes, and every one of
    // their texts comes back, because this is a batch deletion and a batch is exactly where a
    // single returned card would hide the others.
    //
    // A board with nothing settled is NOT an error and NOT a silent success: it answers `removed: 0`
    // with the count it looked at, so a caller can tell "nothing to clear" from "it worked".
    if (removeSettled) {
      // BULK DELETE RUNS ON THE STATE, NEVER ON "HAS AN ACCOUNT". `true` takes the DONE ones —
      // implemented and answered — and leaves `partial` and `blocked` standing, because those
      // carry an account precisely to say work is still outstanding; clearing them would delete
      // exactly the cards that must survive. A state name takes that state alone, which is how
      // "delete all the implemented ones" is said.
      const want = typeof removeSettled === "string" ? removeSettled.trim().toLowerCase() : null;
      if (want && !STATES.includes(want))
        return { ...where, error: `no state "${want}" — one of ${STATES.join(", ")}, or true for the finished ones (${DONE.join(", ")})`, states: STATES };
      const takes = (c) =>
        !!(c.status && c.status.text) && (want ? c.status.state === want : DONE.includes(c.status.state));
      const settled = board.cards.filter(takes);
      board.cards = board.cards.filter((c) => !takes(c));
      if (settled.length) {
        const w = await writeFile(projectCode, { path: boardPath(name), content: serializeBoard(board) });
        if (!w || w.ok === false) return { ...where, error: (w && w.error) || "could not write the board" };
      }
      return {
        ...where,
        ok: true,
        by: as,
        removed: settled.length,
        open: board.cards.length,
        took: want || DONE.join("+"),
        // WHAT WAS LEFT BEHIND IS SAID OUT LOUD. A clear that silently skipped a card carrying an
        // account reads as "the board is clean" when it is not — so the states still standing come
        // back with their counts.
        ...(() => {
          const left = {};
          board.cards.forEach((c) => {
            if (c.status && c.status.text) left[c.status.state || "no state"] = (left[c.status.state || "no state"] || 0) + 1;
          });
          return Object.keys(left).length ? { stillSettled: left } : {};
        })(),
        // Whole, not truncated, and with the account that justified each removal beside it.
        cleared: settled.map((c) => ({ ts: c.ts, status: c.status.text, state: c.status.state, text: c.text })),
      };
    }

    // TAKING A CARD OFF THE BOARD — his ruling, 2026-10-14, after weighing a `done` state against
    // deletion and choosing deletion: *"the board is so fluid that if it is lost, it's not a big
    // deal. If something is still a problem, you might mention it on the board again."* And the
    // argument that settled it: *"if it was so important it would have never just gone on the
    // board"* — a card is real-but-not-urgent by construction, so the cost of losing one is small
    // and the cost of a `done` state is paid by every future reader, forever, re-reading finished
    // rows to reject them. Deleting keeps the card count equal to the outstanding count, which is
    // the one number the surface can show honestly.
    //
    // ID ONLY — NO POSITIONS, and this is deliberately stricter than `reply` above. That path
    // accepts a position with a warning because a reply on the wrong card is noise; a REMOVAL on
    // the wrong card is loss, and positions shift the moment anyone adds a note.
    //
    // THE REMOVED TEXT COMES BACK. A caller is meant to delete a card once its account has landed
    // somewhere — a report, a lane, a commit — so the answer hands the words back, and a removal
    // can never be the only place the card existed.
    if (remove != null) {
      const found = addressCard(board.cards, remove);
      if (found.error) return { ...where, ...found };
      const card = found.card;
      board.cards = board.cards.filter((c) => c !== card);
      const w = await writeFile(projectCode, { path: boardPath(name), content: serializeBoard(board) });
      if (!w || w.ok === false) return { ...where, error: (w && w.error) || "could not write the board" };
      return {
        ...where,
        ok: true,
        removed: card.ts,
        by: as,
        open: board.cards.length,
        // Handed back whole, not truncated: this is the last copy the caller will be offered.
        text: card.text,
        ...(card.replies && card.replies.length ? { replies: card.replies.length } : {}),
      };
    }

    if (reply != null) {
      // RFC-039 — ADDRESS BY ID, NOT BY POSITION. `at: 2` names a place in a list that reorders the
      // moment a note is added: read the board, he writes one, answer — and the reply lands on a
      // card nobody read. That happened. Cards carry a stable ts, and it is always returned.
      const want = String(at || "1");
      const byId = board.cards.find((c) => String(c.ts) === want);
      const card = byId || board.cards[Number(want) - 1];
      if (!card)
        return { ...where, error: `no note "${want}" — the board has ${board.cards.length}`, ids: board.cards.map((c) => c.ts) };
      card.replies = [...(card.replies || []), { by: as, ts: Date.now(), text: String(reply) }];
      const w = await writeFile(projectCode, { path: boardPath(name), content: serializeBoard(board) });
      if (!w || w.ok === false) return { ...where, error: (w && w.error) || "could not write the board" };
      return {
        ...where,
        ok: true,
        answered: card.ts,
        note: card.text.slice(0, 80),
        by: as,
        ...(!byId && board.cards.length > 1 ? { warning: `"${want}" was a POSITION — pass the id (${card.ts}) next time` } : {}),
      };
    }
    // READING ONE GROUP. `state: "open"` answers only the unaccounted ones, `"implemented"` only
    // the finished — the same filter his panel puts on the row of marks, so what an agent can ask
    // for and what he can press are the same question. An unknown state is refused with the
    // vocabulary rather than silently answering nothing, which would read as "none of those".
    if (state) {
      const want = String(state).trim().toLowerCase();
      if (want !== "open" && !STATES.includes(want))
        return { ...where, error: `no state "${want}" — one of ${STATES.join(", ")}, or "open" for the cards with no account yet`, states: STATES };
      const cards = board.cards.filter((c) => {
        const st = c.status && c.status.text ? c.status.state : null;
        return want === "open" ? !st : st === want;
      });
      return { ...where, title: board.title, state: want, cards, of: board.cards.length };
    }
    return { ...where, ...board };
  };
}

module.exports = { boardOn, parseBoard, serializeBoard, boardPath, addressCard, STATES, DONE, stateOf };
