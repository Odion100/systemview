// WHAT IS OWED BY HIM — the derivation, with no React in it so it can be held to its answers.
//
// THE PROBLEM IT EXISTS FOR, in his words: *"I need to be knowing what I need to do. Because you've
// got arcs. You've got arcs with claims. You've got things that need me to get them done. You told
// me there's things that I need to do — you pointed out RFCs. You said those things to me, they go
// by in the chat. Approvals aren't everything."* An obligation an agent mentions is ephemeral; the
// chat scrolls and it is gone forever. The only durable count in the window was approvals, and it
// was wrong in both directions — it counted three MOCK fixtures as decisions he owed, and it
// counted no clock, no blocked objective, no unplanned objective and no drifted claim at all.
//
// TWO GROUPS, AND THE SPLIT IS THE WHOLE DESIGN — it is the literal shape of the question he asked:
//
//   PRESS       your signature finishes it. An unsigned approval, a gap whose proof is already in
//               the file, a report whose retention clock is running out. Each one ends at a control
//               somebody has already built, in the document itself.
//   OUTSTANDING nobody can press it away. An objective that is yours, an objective declared blocked
//               and the reason why, objectives with no plan attached, a draft nothing can decide,
//               claims resting on nothing. These need work, not a verdict.
//
// Four invented tier names (expiring / blocking / itself / decaying) was the first attempt and it
// is rejected: a taxonomy he has to learn in order to read his own obligations is furniture, and
// two of those tiers never differed in what he would DO about them. The two words here are the
// head's legend too — his standing rule for this surface: *"the reason I know it's an approval is
// because it says it above."*
//
// ONE ROW PER DOCUMENT PER OBLIGATION, NEVER PER CLAIM. 44 unproved claims must not become 44
// rows — that is exactly how a surface meant to focus him becomes the thing he scrolls past.
//
// AND IT READS THE DOCUMENT, NOT THE ROW'S COUNTS. The registry row is a cache of the last parse,
// and `facilitation.js` already learned what that costs: the ladder never opened because the row
// said draft about a document whose approvals were signed on screen. The row says WHICH documents
// exist (it is the index, and a leaf is what makes a document real); the text says what they want.
//
// THE PRESS IS NEVER HERE. Every row opens its document, because that is where the control lives —
// the facilitation ladder for an approval, the clock's keep-or-let-go on a report's leaf, the
// objective's own block. A second way to sign was built once and reverted the same day: *"the
// press on the station IS the signature."* A list that signs for you is a list that decides for
// you.
import { parseApprovals } from "../../atoms/Markdown/blocks/facilitation";
import { stateOf } from "../../atoms/Markdown/blocks/lifecycleState";
import { parseRetain, retainLine } from "../../atoms/Markdown/blocks/retention";
import { claimsOf } from "../../atoms/Markdown/claims";
import { parseObjectives, parseArc, plansByObjective, addressOf } from "../../atoms/Markdown/objectives";
import { unfenced } from "../../atoms/Markdown/unfenced";

// A FIXTURE IS NOT WORK — a mock arc's unpressed approval is test data wearing an obligation, and
// three of the eight the band counted on 2026-10-30 were exactly that (`MOCK-RFC-2`, `-3`, `-4`).
//
// TWO SIGNALS, EITHER IS ENOUGH, because the fixtures declare themselves twice and neither
// declaration is complete on its own. The **id** says MOCK — *"the id says MOCK so nobody has to
// wonder"* (mock-rfc.md's own words) — which catches them wherever they live, and it is the signal
// RFC-073's doctrine prefers, since a document is what it says it is and the folder stopped meaning
// anything. But `the-lifecycle-walk.md` and `the-proofs-run.md` are fixtures too and are not named
// MOCK, so `proofs/` carries the rest. Honest limit: both are CONVENTIONS, not declarations. The
// real fix is a leaf attribute, and inventing one unapproved would be worse than naming the gap —
// so what the exclusion removed is COUNTED and said out loud instead of being silent.
const MOCK = /^mock\b/i;
const PROOFS = /(^|\/)proofs\//;
export const isFixture = (row) =>
  MOCK.test(String((row && row.id) || "").trim()) || PROOFS.test(String((row && row.path) || ""));

// WHERE A REGISTRATION LEAF SITS, so a row with nothing more specific to point at lands on the one
// control that can move the document — the leaf's own lifecycle trail. Line 1 is the floor: a
// document whose leaf we cannot find still opens.
const LEAF = /^[ \t]*::(rfc|arc|gap|report)\{/;
export function leafLine(text) {
  const lines = unfenced(text).split("\n");
  for (let i = 0; i < lines.length; i += 1) if (LEAF.test(lines[i])) return i + 1;
  return 1;
}

// The order inside each group — what he would reach for first, stated as data so a reader can
// argue with it. A clock leads PRESS because waiting is the only thing on this surface that
// DESTROYS something. His own objective leads OUTSTANDING because it is the most literal answer to
// "what do I need to do".
const PRESS_RANK = { clock: 1, approval: 2, proof: 3 };
const WORK_RANK = { mine: 1, blocked: 2, unplanned: 3, undecidable: 4, claims: 5 };

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// An ask is a sentence somebody wrote to be read in place; on a one-line row it has to stop.
const clipped = (s, n = 64) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const item = (row, group, why, says, extra = {}) => ({
  key: `${row.id}:${why}`,
  group,
  why,
  id: row.id,
  kind: row.kind,
  path: row.path,
  project: row.project || "",
  line: 1,
  says,
  tail: "",
  ...extra,
});

/**
 * Every obligation one document carries. `rows` is every registry row, because an arc's objectives
 * are planned by documents that live somewhere else entirely — the attachment is `arc=ARC-001-O6`
 * on the plan's own leaf, and the arc's file cannot see it.
 */
function obligationsIn({ row, text }, rows, now) {
  const out = [];
  const st = (row && row.state) || {};
  const state = stateOf(row.kind, row);
  const approvals = parseApprovals(text);
  const unsigned = approvals.filter((a) => !a.verdict);
  const leaf = leafLine(text);

  // ── PRESS ────────────────────────────────────────────────────────────────────────────────────
  // THE CLOCK. A report retires and is gone; nothing else here is destroyed by waiting. `retainLine`
  // is the leaf's own clock face — the same words the document and the drawer row already show, so
  // this cannot disagree with them — and `counting` is false until he has opened it once, which is
  // right: the window measures his attention, so an unread report's clock has not started.
  const windowMs = parseRetain(st.retain);
  const clock = retainLine({ retired: !!st.retired, retain: st.retain, windowMs, openedAt: row.openedAt, now });
  if (clock && clock.counting && clock.urgent)
    out.push(
      item(row, "press", "clock", `${clock.text} — keep it or let it go`, {
        line: leaf,
        tail: state,
        left: row.openedAt + windowMs - now,
      }),
    );

  // AN UNSIGNED APPROVAL. The press is at the end of the facilitation ladder, in the document — so
  // the row points at the block and stops there. Signing from a list would be a second way to sign,
  // and the verdict chips in a document's corner were reverted eight hours before this was written
  // for precisely that reason.
  //
  // AND IT SAYS WHAT IT IS ASKING. `ask=` is the question somebody wrote on the block; "1 approval
  // waits on your verdict" is true of every unsigned approval in the system and therefore tells him
  // nothing about which one to open. One ask fits a row; several do not, so several get the count.
  if (unsigned.length) {
    const ask = unsigned.length === 1 ? clipped(unsigned[0].ask) : "";
    out.push(
      item(row, "press", "approval", ask || `${plural(unsigned.length, "approval")} ${unsigned.length === 1 ? "waits" : "wait"} on your verdict`, {
        line: unsigned[0].line,
        tail: state,
        n: unsigned.length,
      }),
    );
  }

  // A GAP WHOSE PROOF IS ALREADY IN THE FILE. Somebody fixed the thing and left the evidence; all
  // that is missing is the press on `resolved`. `hasProof` is a fact about the whole document and
  // lives on the row — it is the one thing here the text cannot answer.
  if (row.kind === "gap" && state === "open" && st.hasProof)
    out.push(item(row, "press", "proof", "the proof is in the file — one press from resolved", { line: leaf, tail: state }));

  // ── OUTSTANDING ──────────────────────────────────────────────────────────────────────────────
  if (row.kind === "arc") {
    const objectives = parseObjectives(text);
    const arc = parseArc(text);
    const arcId = (arc && arc.id) || row.id;
    const byObj = plansByObjective(rows, arcId);
    const open = objectives.filter((o) => o.state !== "done");

    objectives.forEach((o) => {
      const addr = addressOf(arcId, o.id);
      const named = o.title ? ` — ${o.title}` : "";
      // BLOCKED WINS OVER OWNERSHIP, because it says more: an objective of his that is also stuck
      // needs the obstacle named, not a second row saying it is his.
      //
      // AND THE REASON IS THE ROW'S WORDS. `blocked=` is the one state written rather than derived,
      // on the grounds that it is a statement about the world — and until now that statement was a
      // hover title on one block inside one file. The band head was silent about the only declared
      // blocked objective in the system, because it counted approvals and nothing else.
      if (o.state === "blocked")
        out.push(
          item(row, "work", "blocked", `blocked — ${o.because || "no reason given on the block"}${named}`, {
            key: `${row.id}:blocked:${o.id}`,
            line: o.line,
            tail: addr,
          }),
        );
      else if (o.owner === "you" && o.state !== "done")
        out.push(
          item(row, "work", "mine", `yours, and ${o.state}${named}`, { key: `${row.id}:mine:${o.id}`, line: o.line, tail: addr }),
        );
    });

    // AN OBJECTIVE WITH NO PLAN IS WORK THAT CANNOT START, and the count was the defect: the row
    // said 2 of 4 planned and nothing anywhere said WHICH two. So they are NAMED, in one row —
    // four unplanned objectives are one thing to do, not four rows of the same sentence.
    const unplanned = open.filter((o) => !(byObj[o.id] || []).length);
    if (unplanned.length)
      out.push(
        item(row, "work", "unplanned", `${plural(unplanned.length, "objective")} with no plan attached`, {
          line: unplanned[0].line,
          tail: unplanned.map((o) => o.id).join(" · "),
        }),
      );
  }

  // A DRAFT NOTHING CAN DECIDE. An rfc or an arc reaches every state above draft through a verdict,
  // so one carrying no approval block at all is parked forever and the trail's own refusal says so
  // only if you go and press it. Not a button: an approval block is a thing somebody writes, and
  // offering to fake one would be offering to decide on his behalf.
  if ((row.kind === "rfc" || row.kind === "arc") && state === "draft" && !approvals.length)
    out.push(item(row, "work", "undecidable", "no approval block — nothing can take it out of draft", { line: leaf, tail: state }));

  // CLAIMS RESTING ON NOTHING. `claimsOf` is the same conjunction the registry row derives, so this
  // can never disagree with the document's own bar about the one number both exist to report. One
  // row, however many claims — and `unchecked` and `unproved` are said separately because they are
  // different failures: nobody looked, versus somebody said so and showed nothing.
  const c = claimsOf(text);
  const said = [
    c.unmet ? `${plural(c.unmet, "claim")} unmet` : "",
    c.unchecked ? `${c.unchecked} unchecked` : "",
    c.unproved ? `${c.unproved} marked met with no proof` : "",
  ].filter(Boolean);
  if (said.length) {
    const first = c.claims.find((x) => x.state !== "met" || !x.proved) || c.claims[0];
    out.push(
      item(row, "work", "claims", said.join(" · "), {
        line: (first && first.line) || leaf,
        tail: plural(c.total, "claim"),
        weight: c.unmet + c.unchecked + c.unproved,
      }),
    );
  }

  return out;
}

/**
 * WHAT IS OWED, from the registry and the documents themselves.
 *
 * @param docs `[{ row, text }]` — a registry row, and the document's source. `text` absent means
 *   the file could not be read, which is CARRIED rather than swallowed: a count over eleven of
 *   thirteen documents is not a count, and the specific failure this surface replaces is one that
 *   omitted silently in both directions.
 * @returns `{ press, work, skipped: { fixtures, unreadable, gone }, counted }`
 */
export function owedFrom({ docs = [], now = Date.now() } = {}) {
  const all = (docs || []).filter((d) => d && d.row && d.row.id && d.row.path);
  const rows = all.map((d) => d.row);
  // A RETIRED DOCUMENT IS OUT OF ACTIVE SERVICE and owes nothing — including a PAUSE, which stays
  // in the per-kind lists so it can say why it was put down, but is by definition not work he is
  // behind on. A row whose file is gone owes nothing either, and is counted below instead.
  const live = all.filter((d) => !d.row.missing && !((d.row.state || {}).retired));
  const readable = live.filter((d) => typeof d.text === "string" && d.text.trim());

  const press = [];
  const work = [];
  let fixtures = 0;
  for (const d of readable) {
    const found = obligationsIn(d, rows, now);
    // THE FIXTURES ARE COUNTED, NOT FILTERED INTO SILENCE — the number is what lets him argue with
    // the exclusion instead of taking it on trust.
    if (isFixture(d.row)) {
      fixtures += found.length;
      continue;
    }
    found.forEach((x) => (x.group === "press" ? press : work).push(x));
  }

  press.sort(
    (a, b) =>
      (PRESS_RANK[a.why] || 9) - (PRESS_RANK[b.why] || 9) ||
      (a.why === "clock" ? (a.left || 0) - (b.left || 0) : (b.n || 0) - (a.n || 0)) ||
      String(a.id).localeCompare(String(b.id)),
  );
  work.sort(
    (a, b) =>
      (WORK_RANK[a.why] || 9) - (WORK_RANK[b.why] || 9) ||
      (b.weight || 0) - (a.weight || 0) ||
      String(a.id).localeCompare(String(b.id)) ||
      String(a.tail).localeCompare(String(b.tail)),
  );

  return {
    press,
    work,
    counted: readable.length,
    skipped: {
      fixtures,
      unreadable: live.length - readable.length,
      gone: all.filter((d) => d.row.missing).length,
    },
  };
}

/**
 * The one line that says what was LEFT OUT, or "" when nothing was. It is a sentence rather than
 * three numbers because each omission means something different, and a surface that silently omits
 * is the specific failure this one replaces.
 */
export function skippedLine(skipped = {}) {
  const parts = [
    skipped.fixtures ? `${skipped.fixtures} in proof fixtures` : "",
    skipped.gone ? `${plural(skipped.gone, "row")} pointing at a file that is gone` : "",
    skipped.unreadable ? `${plural(skipped.unreadable, "document")} that could not be read` : "",
  ].filter(Boolean);
  return parts.length ? `not counted: ${parts.join(" · ")}` : "";
}

/**
 * WHAT THE BAND HEAD SAYS — and the MARK BELONGS TO THE KIND, never to the position.
 *
 * ⚑ MEANS "A DECISION IS WAITING ON YOU". That is not a new rule; it is written into this band
 * already, at the arc row: *"⊘, NOT ⚑. The flag means 'a decision is waiting on you' on reports and
 * RFCs; an arc with a blocked objective is a different situation and sharing one mark made the band
 * unreadable — 'I don't know what the other one is.'"* The head drew ⚑ on whichever press segment
 * happened to come first, which put the approval flag in front of a report's clock — the identical
 * mistake that split cost, paid twice. So an approval and a gap's waiting proof carry ⚑ because both
 * end at a verdict of his, and a clock carries ⧗ because a deadline is not a decision: nothing he
 * presses makes it not have been due.
 *
 * AND APPROVALS LEAD. The head he had before this said `⚑ N approval waiting` as its own first
 * segment, and his instruction for the row is that it be about *"things like approvals waiting"*.
 * The clock is louder in consequence — it is the only thing here that destroys something — but it
 * is not what he opens this band to find, and it keeps its own mark so leading with approvals
 * cannot bury it.
 *
 * THE HEADER IS THE LEGEND, which is why every mark has its word beside it and a new kind of
 * attention has to earn a word here before it earns a glyph anywhere below.
 *
 * APPROVALS ARE COUNTED AS BLOCKS, NOT ROWS. One document holding two unsigned approvals is one row
 * down in the list and two decisions up here, because this number answers "how many times do I have
 * to decide something" and the row answers "where do I go".
 *
 * THE OUTSTANDING HALF KEEPS ONE WORD, deliberately. It holds an objective of his, a blocked one,
 * objectives with no plan, a draft nothing can decide and claims resting on nothing — five unlike
 * things whose only shared fact is the one he needs from them up here: no press of his makes any of
 * them go away. Naming all five is how this row becomes the inventory he threw out. It carries no
 * mark, because a mark would promise a control that does not exist.
 *
 * `nothing owed` is said OUT LOUD when it is true and we really read everything — that zero is the
 * answer he has never been able to get, and leaving the head blank would read as "not measured".
 * `unread` rides it, because a zero over documents nobody could open is not a zero.
 */
const PRESS = {
  approval: { mark: "⚑", word: (n) => `${plural(n, "approval")} waiting` },
  proof: { mark: "⚑", word: (n) => `${plural(n, "proof")} to sign` },
  clock: { mark: "⧗", word: (n) => `${n} expiring` },
};
const PRESS_ORDER = ["approval", "proof", "clock"];

// THE OUTSTANDING WORDS, in the order they are offered. Each one says what the work IS, because
// the segment is now a filter and "outstanding" filters to nothing in particular. The order is
// `WORK_RANK`'s — the same ranking the list below the head is already sorted by, so the segments
// read in the same order as the rows they select.
const WORK = {
  mine: (n) => `${plural(n, "objective")} yours`,
  blocked: (n) => `${n} blocked`,
  unplanned: (n) => `${n} with no plan`,
  undecidable: (n) => `${plural(n, "draft")} nothing can decide`,
  claims: (n) => `${plural(n, "claim set")} resting on nothing`,
};
const WORK_ORDER = ["mine", "blocked", "unplanned", "undecidable", "claims"];

// How many DECISIONS a press row carries. An approval row stamps `n` with the number of unsigned
// blocks in that document; everything else is one.
const decisions = (rows) => rows.reduce((t, r) => t + (r.n || 1), 0);

export function owedHead(owed = {}) {
  const press = owed.press || [];
  const work = (owed.work || []).length;
  const unread = (owed.skipped || {}).unreadable || 0;
  const segs = [];
  // EVERY SEGMENT CARRIES THE ITEMS IT COUNTED. A surface that lets him press "4 approvals
  // waiting" to see those four must show the same four the number came from — and the only way
  // to guarantee that is for the number and the list to be the same array, rather than two
  // filters written in two places that agree until one of them is edited.
  for (const why of PRESS_ORDER) {
    const mine = press.filter((p) => p.why === why);
    if (mine.length)
      segs.push({ key: why, flag: PRESS[why].mark, text: PRESS[why].word(decisions(mine)), keys: mine.map((p) => p.key) });
  }
  // A PRESS KIND THIS FILE HAS NOT MET YET STILL COUNTS, under the old bucket word and under ⚑ —
  // it is in the press group, so it ends at something he does. A new `why` must not vanish out of
  // the head because nobody added a word for it: an undercount reads as RESOLVED, which is the one
  // thing this number may never say. Membership is tested against PRESS_ORDER rather than
  // `PRESS[why]`, or a `why` of "constructor" would find Object.prototype and be called.
  const rest = press.filter((p) => !PRESS_ORDER.includes(p.why));
  const unnamed = decisions(rest);
  if (unnamed) segs.push({ key: "press", flag: "⚑", text: `${unnamed} to press`, keys: rest.map((p) => p.key) });

  // OUTSTANDING IS BROKEN OUT BY WHAT IT IS, not left as one lump. His ask: *"of course I want to
  // filter by obligations, and add more obligations up there."* One segment reading "10
  // outstanding" is a number you cannot act on and, now that a segment is a FILTER, a press on it
  // narrows to everything-that-is-not-a-decision — which is no narrowing at all. Four objectives
  // with no plan and two drifted claim sets are different jobs on different days.
  const rows = owed.work || [];
  for (const why of WORK_ORDER) {
    const mine = rows.filter((w) => w.why === why);
    if (mine.length) segs.push({ key: why, flag: "", text: WORK[why](mine.length), keys: mine.map((w) => w.key) });
  }
  // SAME GUARANTEE AS THE PRESS SIDE: a `why` this file has not met yet still counts, under the
  // old lump word. An undercount reads as RESOLVED, which is the one thing this number may never
  // say — so a new kind of outstanding work appears rather than vanishing until somebody adds a
  // word for it.
  const strays = rows.filter((w) => !WORK_ORDER.includes(w.why));
  if (strays.length)
    segs.push({ key: "work", flag: "", text: `${strays.length} outstanding`, keys: strays.map((w) => w.key) });
  // Nothing owed is not a filter — there is nothing behind it to show.
  if (!segs.length && owed.counted) segs.push({ key: "clear", flag: "", text: "nothing owed", keys: [] });
  return { segs, unread };
}

/**
 * FOLD A LIST OF OBLIGATIONS INTO ONE ROW PER DOCUMENT.
 *
 * His complaint, and it is the same complaint that produced the never-per-claim rule one level
 * up: *"it has multiple of the same RFC or arc with multiple things outstanding — outstanding
 * should be expandable, it should be bringing those things together. Just gonna flood every
 * little block on a fucking document to you? No."* An arc with five blocked objectives is one
 * document he has to go and work on, not five lines he has to read past to find the next
 * document. So the DOCUMENT is the row, and its obligations are what the row opens into.
 *
 * THE INPUT ORDER IS THE OUTPUT ORDER, and that is load-bearing: `owedFrom` has already sorted
 * by rank, so first-seen means strongest, and the group inherits the first item's `why`, `says`
 * and `line`. Re-sorting here would quietly promote a document because it had MORE obligations,
 * which is not the same as having a worse one.
 *
 * THE KEY CARRIES THE PROJECT. A document id is unique inside a project and nowhere else — two
 * projects each with an RFC-001 are two documents, and keying on the id alone merges them into
 * one row that opens the wrong file.
 *
 * Returns the same shape a single obligation has, plus `items` (all of them, including the one in
 * the headline) and `n`. A row with `n === 1` is an ordinary row and must render as one: a fold
 * that opens to reveal the line already on its face is furniture.
 */
export function groupOwed(items = []) {
  const byDoc = new Map();
  const out = [];
  for (const o of items || []) {
    if (!o) continue;
    const k = `${o.project || ""}\u0000${o.id}`;
    let g = byDoc.get(k);
    if (!g) {
      g = { ...o, key: k, items: [], n: 0 };
      byDoc.set(k, g);
      out.push(g);
    }
    g.items.push(o);
    g.n = g.items.length;
  }
  return out;
}

export default owedFrom;
