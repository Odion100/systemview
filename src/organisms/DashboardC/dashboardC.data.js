// THE SHELVES — the derivation behind the cross-project dashboard, with no React in it so every
// number on that page can be argued with in jest.
//
// WHAT THE PAGE IS FOR, in his words: *"the dashboard is about all the different kind of things,
// you know, arcs or RFCs, in their progress, and reports"* — and *"to be able to see all the stuff
// that's waiting, all the projects going on at the same time."* So the page answers two questions
// in that order: **what needs me**, then **what is going on**. Everything here serves one of those
// two and nothing serves inventory.
//
// IT DERIVES NOTHING NEW, AND THAT IS THE WHOLE DISCIPLINE. A second answer to "how far along is
// ARC-001" is how a surface starts disagreeing with the drawer that taught it. So:
//
//   which rows exist, in what order   → arcRows / rfcRows / gapRows (the band's own modules)
//   which station a document is at    → lifecycleState.stateOf (the function the trail draws)
//   what a row says about itself      → arcLine / rfcLine / gapLine / retainLine
//   how far along an RFC is           → claims.claimsOf
//   what is owed by him               → owed.owedFrom / owedHead / skippedLine
//   whether a document is a fixture   → owed.isFixture
//
// THE TWO THINGS NOBODY HAD WRITTEN, and they are both here with tests rather than in the
// component: an ORDER for reports (no `reportRows` module exists — the drawer sorts them in
// AgentChat itself, which an import cannot reach), and the JOIN from an owed obligation back onto
// the document it belongs to, which is what lets a card say "this one needs you" without counting
// anything a second time.
import { arcLine, arcRows } from "../AgentChat/arcRows";
import { gapLine, gapRows } from "../AgentChat/gapRows";
import { isFixture, owedFrom, owedHead, skippedLine, docKey } from "../AgentChat/owed";
import { rfcLine, rfcRows } from "../AgentChat/rfcRows";
import { stateOf, GROUP_OF, TRAILS } from "../../atoms/Markdown/blocks/lifecycleState";
import { parseRetain, retainLine } from "../../atoms/Markdown/blocks/retention";
import { claimsOf } from "../../atoms/Markdown/claims";

/** The four registered kinds, in the order the page stacks them: the work first, the record last. */
export const KINDS = ["arc", "rfc", "gap", "report"];
export const KIND_WORD = { arc: "arc", rfc: "RFC", gap: "gap", report: "report" };
export const KIND_PLURAL = { arc: "arcs", rfc: "RFCs", gap: "gaps", report: "reports" };

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const fileName = (path) => String(path || "").split("/").pop() || "";
const titleFromPath = (path) =>
  fileName(path)
    .replace(/\.(md|markdown)$/i, "")
    .replace(/^(RFC|ARC|GAP|G)-\d+[-_]?/i, "")
    .replace(/^report\.[^.]+\./i, "")
    .replace(/[-_.]+/g, " ")
    .trim();

/**
 * THE JOIN: obligation → document. `owedFrom` returns a flat list of what is owed, and the shelves
 * need it the other way round — so a card can carry the mark without the page counting anything
 * twice. One entry per document, never per obligation, addressed by `docKey`: this page spans
 * every project at once, which is exactly where a bare document id stops being an address.
 *
 * `says` keeps the obligations' own sentences in their own order, because that is the only text on
 * this page that names a SPECIFIC thing to do; a card that said "2 things owed" would be the
 * inventory this page exists to replace.
 */
export function owedIndex(owed = {}) {
  const out = {};
  const add = (group) => (x) => {
    const k = docKey(x);
    const at = (out[k] = out[k] || { press: 0, work: 0, says: [], lines: [] });
    at[group] += group === "press" ? x.n || 1 : 1;
    at.says.push(x.says);
    at.lines.push(x.line || 1);
  };
  (owed.press || []).forEach(add("press"));
  (owed.work || []).forEach(add("work"));
  return out;
}

// ─── THE METERS — one per kind, because progress MEANS something different per kind ─────────────
//
// This is the part of the page that refuses to flatter. A single "percent done" over four kinds
// would be a number nothing could act on; worse, for an RFC it would have to pick a side in the
// one distinction the whole claims design exists to keep: **met is marked met AND proved.** So the
// RFC meter carries `unproved` as its own segment rather than folding it in either direction — a
// bar where "said" and "shown" are visibly different widths is the point of drawing it at all.

/**
 * AN RFC'S BAR — four segments over its claims, and the second one is the debt. `claimsOf` is the
 * same conjunction the registry row and the document's own `::claims` block derive, so this can
 * never disagree with either about the one number all three exist to report.
 */
export function claimMeter(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const c = claimsOf(text);
  if (!c.total) return null;
  const say = [
    `${c.met} of ${c.total} proved`,
    c.unproved ? `${c.unproved} said, not shown` : "",
    c.unmet ? `${plural(c.unmet, "unmet")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    total: c.total,
    // `unproved` sits NEXT TO `met` on purpose: it is the width of the lie a green bar would tell.
    segs: [
      { k: "met", n: c.met },
      { k: "unproved", n: c.unproved },
      { k: "unmet", n: c.unmet },
      { k: "unchecked", n: c.unchecked },
    ].filter((s) => s.n > 0),
    say,
    debt: c.unproved,
  };
}

/**
 * AN ARC'S BAR — objectives, from the row `arcRows` already built. `blocked` is the number that
 * changes what he does next: an arc at 2 of 7 with nothing blocked is moving, and the same arc
 * with four blocked is waiting on something. Same two numbers the band shows, drawn instead of
 * written.
 */
export function objectiveMeter(arcRow) {
  if (!arcRow || !arcRow.total) return null;
  const blocked = Math.min(arcRow.blocked || 0, arcRow.total - arcRow.done);
  return {
    total: arcRow.total,
    segs: [
      { k: "done", n: arcRow.done },
      { k: "blocked", n: blocked },
      { k: "open", n: arcRow.total - arcRow.done - blocked },
    ].filter((s) => s.n > 0),
    say: arcLine(arcRow),
    debt: blocked,
  };
}

/**
 * A REPORT'S BAR IS A CLOCK DRAINING — the one meter here that moves on its own, and the only
 * thing on this page that gets WORSE while he does nothing. `retainLine` is the leaf's own clock
 * face, so the words are the words the document and the drawer row already show.
 *
 * AND IT DOES NOT START UNTIL HE HAS OPENED IT (`openedAt`), which is right: the window measures
 * his attention, so an unread report has no bar at all — it has a sentence saying when it would
 * begin. Drawing a full bar there would be the surface inventing urgency.
 */
export function clockMeter(row = {}, now = Date.now()) {
  const st = row.state || {};
  const windowMs = parseRetain(st.retain);
  const clock = retainLine({ retired: !!st.retired, retain: st.retain, windowMs, openedAt: row.openedAt, now });
  if (!clock) return st.invalid ? { say: "no retention declared on the leaf", invalid: true } : null;
  if (!clock.counting) return { say: clock.text, counting: false, urgent: false };
  const spent = Math.max(0, Math.min(windowMs, now - row.openedAt));
  return {
    total: windowMs,
    segs: [
      { k: "spent", n: spent },
      { k: "left", n: windowMs - spent },
    ].filter((s) => s.n > 0),
    say: clock.text,
    counting: true,
    urgent: !!clock.urgent,
    left: windowMs - spent,
  };
}

// REPORTS HAVE NO ROW MODULE, so this is the one order written here. The rule: the ones RUNNING
// OUT first, soonest to go at the front, because a report is the only kind on this page that
// disappears — then everything whose clock has not started (he has not read it yet), then the
// permanent and the undeclared, newest first inside each band. A report nobody has opened sorts
// above a permanent one deliberately: unread is a thing to do, permanent is a thing to keep.
const REPORT_BAND = (m) => (m && m.counting ? 0 : m && m.counting === false && m.say && /after first read/.test(m.say) ? 1 : 2);
function reportCards(docs, now) {
  return docs
    .map((d) => ({ d, m: clockMeter(d.row, now) }))
    .sort((a, b) => {
      const band = REPORT_BAND(a.m) - REPORT_BAND(b.m);
      if (band) return band;
      if (a.m && b.m && a.m.counting && b.m.counting) return (a.m.left || 0) - (b.m.left || 0);
      return (b.d.row.at || 0) - (a.d.row.at || 0);
    })
    .map(({ d }) => d);
}

/**
 * ONE CARD PER DOCUMENT — what a face on the shelf says without being opened.
 *
 * `station` comes from `stateOf`, the function that draws the trail on the document itself, so the
 * card and the document can never disagree about where a thing stands. The LEAF is not passed,
 * because this page has not parsed one: it reads the registry row, which is the cache of the last
 * parse — and `stale` is carried onto the card so a row that is behind its file can SAY so instead
 * of quietly being wrong.
 */
function cardOf({ row, text }, { now, owedBy = {}, extra = {}, line }) {
  // KEYED BY PROJECT AND ID, the same key owedIndex built — the id alone spans projects.
  const o = owedBy[docKey(row)];
  return {
    key: `${row.project || ""}:${row.id}`,
    id: row.id,
    kind: row.kind,
    project: row.project || "",
    path: row.path,
    title: row.title || titleFromPath(row.path),
    station: row.state ? stateOf(row.kind, row) : "",
    line: line || "",
    // THE ROW'S OWN TWO FIELDS, CARRIED NOT COPIED — `RetainClock` is the drawer's counting face
    // and it wants exactly these, so a report card can mount the one clock that already exists
    // instead of the page growing a second one.
    rowState: row.state || {},
    openedAt: row.openedAt || 0,
    stale: !!row.stale,
    missing: !!row.missing,
    // A DOCUMENT WHOSE FILE COULD NOT BE READ IS SAID OUT LOUD, never dropped and never guessed
    // at. Half this page's numbers come out of the text; a card that hid the failure would be
    // reporting a measurement it did not take.
    unread: !row.missing && typeof text !== "string",
    fixture: isFixture(row),
    press: (o && o.press) || 0,
    work: (o && o.work) || 0,
    says: (o && o.says) || [],
    at: (o && o.lines && o.lines[0]) || 1,
    ...extra,
  };
}

/**
 * THE CARDS OF ONE KIND, IN THE ORDER THAT KIND IS ALREADY ORDERED IN. Each band module owns its
 * sort and its exclusions — a retirement that is an ENDING leaves the RFC and gap lists, an
 * unfinished arc leads — and this re-reads none of it: it runs the module, then joins the meter on.
 *
 * AN UNREADABLE DOCUMENT STILL GETS A CARD, at the end. `arcRows`, `rfcRows` and `gapRows` all
 * require text and `arcRows` filters without it, so a file the hub could not open would otherwise
 * vanish from the shelf — the exact silent omission this whole surface exists to stop.
 */
export function cardsFor(kind, docs = [], { now = Date.now(), owedBy = {} } = {}) {
  const mine = docs.filter((d) => d && d.row && d.row.kind === kind && d.row.id && d.row.path);
  const byPath = new Map(mine.map((d) => [d.row.path, d]));
  const readable = mine.filter((d) => typeof d.text === "string");
  const out = [];
  const taken = new Set();

  if (kind === "arc") {
    arcRows(readable.map((d) => ({ path: d.row.path, text: d.text }))).forEach((r) => {
      const d = byPath.get(r.path);
      if (!d) return;
      taken.add(r.path);
      out.push(
        cardOf(d, {
          now,
          owedBy,
          line: arcLine(r),
          extra: { owner: r.owner || "", meter: objectiveMeter(r), complete: !!r.complete },
        }),
      );
    });
  } else if (kind === "rfc") {
    rfcRows(readable.map((d) => ({ path: d.row.path, text: d.text, row: d.row }))).forEach((r) => {
      const d = byPath.get(r.path);
      if (!d) return;
      taken.add(r.path);
      out.push(
        cardOf(d, { now, owedBy, line: rfcLine(r), extra: { title: r.title || titleFromPath(r.path), meter: claimMeter(d.text) } }),
      );
    });
  } else if (kind === "gap") {
    gapRows(readable.map((d) => ({ path: d.row.path, text: d.text, row: d.row }))).forEach((r) => {
      const d = byPath.get(r.path);
      if (!d) return;
      taken.add(r.path);
      // A GAP GETS NO BAR, deliberately. It is open or it is closed — there is no middle to draw,
      // and a two-step bar pretending to be progress would be the one invented number on this page.
      // What a gap has instead is DISTANCE TO THE PRESS, and `gapLine` already says it in words:
      // "open · proof ready" is one press from resolved and "open" is not.
      out.push(cardOf(d, { now, owedBy, line: gapLine(r), extra: { meter: null, ready: !!(r.hasProof && r.state === "open") } }));
    });
  } else {
    reportCards(readable, now).forEach((d) => {
      taken.add(d.row.path);
      const m = clockMeter(d.row, now);
      out.push(cardOf(d, { now, owedBy, line: (m && m.say) || "filed", extra: { meter: m } }));
    });
  }

  // WHAT THE ROW MODULES LEFT BEHIND — and it is NOT all unreadable. `rfcRows` and `gapRows` both
  // drop documents whose retirement is an ENDING (cancelled, superseded, out of service), so a
  // perfectly readable cancelled RFC never reaches `taken` and used to land here labelled "could
  // not read the file" — on a card that simultaneously showed `station: retired` from `stateOf`.
  // A card contradicting itself about a document it read fine is the exact lie this page exists
  // to stop, and it inflated the shelf's `unread` count on top.
  // THREE DIFFERENT ABSENCES, said as three different things: the file is gone, the work was
  // ended on purpose, or it genuinely would not read.
  mine
    .filter((d) => !taken.has(d.row.path))
    .forEach((d) => {
      const ended = GROUP_OF(((d.row.state || {}).retiredAs) || "") === "ending";
      out.push(
        cardOf(d, {
          now,
          owedBy,
          line: d.row.missing
            ? "the file this row points at is gone"
            : ended
            ? `ended — ${((d.row.state || {}).retiredAs) || "retired"}`
            : "could not read the file",
          extra: { meter: null, ended },
        }),
      );
    });
  return out;
}

/**
 * THE WHOLE PAGE'S DATA, from the registry and the documents themselves.
 *
 * @param docs `[{ row, text }]` — every registry row across every project, and the source of each
 *   one that could be read. `text` absent means it could not be, which is CARRIED: `owedFrom`
 *   counts it out loud and the card says so.
 * @param roots `{ [projectCode]: absoluteRoot }` from `SystemView.projectRoots()` — the WIDEST
 *   list of projects, which is why it is asked for separately. A project with a folder and no
 *   registered document still gets a shelf saying nothing is registered there; dropping it would
 *   make "no arcs anywhere" indistinguishable from "that project was never parsed".
 */
export function shelvesFrom({ docs = [], roots = {}, now = Date.now() } = {}) {
  const all = (docs || []).filter((d) => d && d.row && d.row.id && d.row.path);
  const owed = owedFrom({ docs: all, now });
  const owedBy = owedIndex(owed);

  const codes = [...new Set([...Object.keys(roots || {}), ...all.map((d) => d.row.project || "")])]
    .filter((c) => c || all.some((d) => !d.row.project))
    .sort((a, b) => String(a).localeCompare(String(b)));

  const shelves = codes
    .map((project) => {
      const mine = all.filter((d) => (d.row.project || "") === project);
      const cards = {};
      const counts = {};
      KINDS.forEach((k) => {
        cards[k] = cardsFor(k, mine, { now, owedBy });
        counts[k] = cards[k].length;
      });
      const flat = KINDS.flatMap((k) => cards[k]);
      return {
        project,
        root: (roots || {})[project] || "",
        cards,
        counts,
        documents: flat.length,
        // THE SHELF'S OWN HEADLINE, and it is not a document count: *"what needs me"* is the
        // question, so the shelf leads with presses and outstanding work and says the inventory
        // second. A project whose only number is "31 documents" has told him nothing.
        press: flat.reduce((n, c) => n + c.press, 0),
        work: flat.reduce((n, c) => n + c.work, 0),
        unread: flat.filter((c) => c.unread).length,
      };
    })
    // BUSIEST SHELF FIRST — the one asking for the most leads, because the page is a place to act.
    // Ties break on documents, then alphabetically, so the order is stable between polls.
    .sort(
      (a, b) =>
        b.press + b.work - (a.press + a.work) ||
        b.documents - a.documents ||
        String(a.project).localeCompare(String(b.project)),
    );

  return {
    shelves,
    owed,
    owedBy,
    head: owedHead(owed),
    skipped: skippedLine(owed.skipped || {}),
    counted: owed.counted,
    documents: all.length,
    projects: shelves.length,
    // THE ONE THING AN EMPTY PAGE MUST NEVER DO IS READ AS "nothing to do". Three different
    // emptinesses, named separately, because they mean three different things: no project is known
    // at all, projects are known and nothing is registered, or documents are registered and not one
    // of them could be opened.
    empty: !shelves.length ? "projects" : !all.length ? "documents" : !owed.counted ? "unread" : "",
  };
}

/**
 * THE CURRENT — every document in the system as a dot on its kind's lifecycle, all projects at
 * once. This is the "what is going on" half, and it is the one picture on the page that shows
 * MOVEMENT rather than contents: a pile at `draft` is a planning backlog, a pile at `built` is
 * proof debt, a pile at `approved` on arcs is work nobody has planned yet. None of it is a number
 * he has to read — it is where the mass sits.
 *
 * THE STATIONS ARE THE TRAIL'S OWN. `TRAILS` via `stateOf`'s vocabulary, not a list retyped here —
 * and `rejected` is appended per kind only when something is actually in it, because a station
 * nothing has ever reached reads as "still coming" on a trail and as clutter on a track.
 */
// AND IT REALLY IS `TRAILS` NOW. This was a retyped copy of those four arrays sitting directly
// under a comment claiming it was not one — the values matched on the day they were typed, so
// nothing looked broken, and a station added to `lifecycleState` would simply never appear here.
// The one place a document's stations are declared is the one place they are read from.
const TRACK = TRAILS;
export function currentFrom(shelves = []) {
  return KINDS.map((kind) => {
    const cards = shelves.flatMap((s) => s.cards[kind] || []);
    const stations = [...TRACK[kind]];
    cards.forEach((c) => {
      if (c.station && !stations.includes(c.station)) stations.push(c.station);
    });
    return {
      kind,
      total: cards.length,
      stations: stations
        .map((station) => ({ station, cards: cards.filter((c) => c.station === station) }))
        // A station with nothing in it stays ON the track (it is where things are GOING), unless the
        // trail never promised it — a `rejected` nobody reached is noise, not a destination.
        .filter((s) => s.cards.length || TRACK[kind].includes(s.station)),
      // Documents the registry has no state for at all. Not a station — an absence, and it is said
      // beside the track rather than drawn on it, because "not parsed" is not a place.
      unparsed: cards.filter((c) => !c.station).length,
    };
  }).filter((t) => t.total);
}

export default shelvesFrom;
