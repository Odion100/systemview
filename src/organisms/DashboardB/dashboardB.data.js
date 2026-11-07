// THE FLOOR — the derivation behind the cross-project dashboard, with no React in it so every
// answer on the page is provable in Jest. The component is a wire; this is the thinking.
//
// WHAT THE PAGE IS FOR, in his words: *"the dashboard is about all the different kind of things,
// you know, arcs or RFCs, in their progress, and reports"* and *"to be able to see all the stuff
// that's waiting, all the projects going on at the same time."*
//
// THE POINT OF VIEW THIS FILE COMMITS TO: a document is not a row in an inventory, it is a thing
// STANDING SOMEWHERE on a trail, with its own progress inside it, and the useful picture is WHERE
// EVERYTHING IS STANDING. A heap of RFCs parked at `draft` and a heap parked at `built` are the
// same count and completely different problems; a table shows one number for both. So the page is
// a set of TRACKS — the lifecycle trails that already exist — with every document drawn as a bead
// at its own station, and the reports (which do not progress, they only age) drawn as the one
// thing they really are: a stack that is draining.
//
// IT DERIVES NOTHING NEW ABOUT PROGRESS. Every number below is asked of the module that already
// owns it — `claimsOf` for an RFC's claims, `arcRows` for an arc's objectives, `gapRows` for a
// gap's fork, `retainLine` for a report's clock, `stateOf` for the station, `owedFrom` for what is
// owed. What IS new here is only the SHAPE: grouping, bucketing, ordering, and the sentences that
// say how much of the system was actually read. A second answer to "how far along is this arc" is
// how a surface starts disagreeing with the drawer, so there isn't one.
import { TRAILS, stateOf } from "../../atoms/Markdown/blocks/lifecycleState";
import { parseRetain, retainLine, spanWords } from "../../atoms/Markdown/blocks/retention";
import { claimsOf } from "../../atoms/Markdown/claims";
import arcRows, { arcLine } from "../AgentChat/arcRows";
import gapRows, { gapLine } from "../AgentChat/gapRows";
import rfcRows, { rfcLine } from "../AgentChat/rfcRows";
import { isFixture, leafLine, owedFrom, skippedLine, docKey } from "../AgentChat/owed";

// ─── THE KINDS ─────────────────────────────────────────────────────────────────────────────────
// The hues are HowWeWork's, deliberately: that page teaches what a kind IS, and two surfaces in
// one window disagreeing about what purple means is a cost paid by the reader, not by us. The
// styles declare the actual values with a dark-mode step; these are the var names.
export const KINDS = [
  { kind: "rfc", label: "RFCs", one: "RFC", blurb: "a design, reduced to claims somebody can check" },
  { kind: "arc", label: "arcs", one: "arc", blurb: "a body of work, made of objectives with owners" },
  { kind: "gap", label: "gaps", one: "gap", blurb: "something another project gets wrong, filed where the fix lives" },
  { kind: "report", label: "reports", one: "report", blurb: "an account of work done — a view, with a clock on it" },
];

// THE TRACKED KINDS ARE THE ONES THAT MOVE. An rfc, an arc and a gap each walk a trail, so each
// gets a track and a bead per document. A report's trail is `filed → retired` — two stations, and
// the second is its death — so a report track would draw one pile and teach nothing. Reports are
// not progressing, they are AGEING, and the honest picture of them is the stack below.
export const TRACK_KINDS = ["rfc", "arc", "gap"];

/** The stations one kind's track draws, left to right — the trail itself, nothing invented. */
export const stationsFor = (kind) => (TRAILS[kind] || []).slice();

// ─── PROGRESS, PER KIND, FROM THE MODULE THAT OWNS IT ──────────────────────────────────────────
//
// `ratio` is 0..1 or null, and NULL IS A REAL ANSWER — an RFC with no claims list has no progress,
// and drawing it as 0% would be the page inventing a failure. `says` is the sentence the kind's own
// row-liner already writes, so the bead's tooltip and the drawer cannot disagree. `warn` is the one
// thing per kind that is worth a different colour: a claim marked met with nothing behind it, an
// objective declared blocked, a gap claiming resolved with no proof, a clock about to run out.
//
// DRAINING vs FILLING, and it matters to the drawing: an arc at 0.8 is nearly finished and good; a
// report at 0.8 has 80% of its life LEFT and is only good while the number is high. `drains` says
// which way to read the ring so the component does not have to know per-kind rules.
export function progressFor({ row, text } = {}, now = Date.now()) {
  const kind = (row && row.kind) || "";
  const st = (row && row.state) || {};
  // "COULD NOT BE READ" IS AN ACCUSATION, AND IT MUST ONLY BE MADE WHEN IT IS TRUE. A retired
  // document and a row whose file is gone are both deliberately unread — saying the reader failed
  // where the reader never tried is exactly the kind of lie this page is built not to tell.
  if (row && row.missing) return { ratio: null, says: "the file it points at is gone", warn: "the file is gone", drains: false, unread: true };
  if (st.retired)
    return { ratio: null, says: st.retiredAs ? `retired — ${st.retiredAs}` : "retired", warn: "", drains: kind === "report" };
  if (typeof text !== "string" || !text.trim())
    return { ratio: null, says: "could not be read", warn: "", drains: false, unread: true };

  if (kind === "rfc") {
    const c = claimsOf(text);
    const [r] = rfcRows([{ path: row.path, text, row }]);
    return {
      ratio: c.total ? c.met / c.total : null,
      says: c.total ? `${c.met} of ${c.total} claims met and proved` : (r && rfcLine(r)) || "no claims list yet",
      warn: c.unproved ? `${c.unproved} marked met with no proof` : c.unchecked ? `${c.unchecked} unchecked` : "",
      drains: false,
    };
  }
  if (kind === "arc") {
    const [r] = arcRows([{ path: row.path, text }]);
    if (!r) return { ratio: null, says: "no objectives in it", warn: "", drains: false };
    return {
      ratio: r.total ? r.done / r.total : null,
      says: arcLine(r),
      warn: r.blocked ? `${r.blocked} blocked` : r.total ? "" : "no objectives in it",
      drains: false,
    };
  }
  if (kind === "gap") {
    const [r] = gapRows([{ path: row.path, text, row }]);
    // HALF FOR A PROOF ALREADY IN THE FILE. It is not two thirds of the way fixed — it is FIXED and
    // unsigned, which is a press away, and the half-ring is what makes that visible without a word.
    const ratio = !r ? null : r.state === "resolved" ? 1 : r.state === "rejected" ? 1 : r.hasProof ? 0.5 : 0;
    return {
      ratio,
      says: (r && gapLine(r)) || "open",
      warn: r && r.declared ? "says resolved with no proof in it" : "",
      drains: false,
    };
  }
  // A REPORT'S PROGRESS IS ITS CLOCK, AND IT RUNS DOWN. `retainLine` is the leaf's own face, so the
  // words here are the words the document shows. The clock does not start until he FIRST OPENS it
  // (RFC-076 §4.6) — an unread report's ring is FULL and says so, because the window measures his
  // attention and an unread report has not spent any.
  const windowMs = parseRetain(st.retain);
  const clock = retainLine({ retired: !!st.retired, retain: st.retain, windowMs, openedAt: row.openedAt, now });
  if (!clock) return { ratio: null, says: st.retired ? "retired" : "no retention declared", warn: "", drains: true };
  const left = typeof windowMs === "number" && row.openedAt ? Math.max(0, row.openedAt + windowMs - now) : null;
  return {
    ratio: left === null ? (windowMs === null ? 1 : null) : Math.min(1, left / windowMs),
    says: clock.text,
    warn: clock.urgent ? "the clock is nearly out" : "",
    drains: true,
    counting: !!clock.counting,
    urgent: !!clock.urgent,
    left,
  };
}

// ─── ONE BEAD ──────────────────────────────────────────────────────────────────────────────────

/**
 * A document as the page draws it: where it stands, how far along it is inside that, and what it
 * wants from him. `line` is where a click should land — the obligation's own block when it has one,
 * the registration leaf otherwise, so a press is one scroll away rather than a file hunt.
 */
export function beadFor({ row, text }, owedByDoc = {}, now = Date.now()) {
  const p = progressFor({ row, text }, now);
  // KEYED BY PROJECT AND ID — on a page that spans every project, the id alone is not an address.
  const mine = owedByDoc[docKey(row)] || [];
  const press = mine.filter((o) => o.group === "press");
  const work = mine.filter((o) => o.group === "work");
  const first = press[0] || work[0] || null;
  return {
    key: `${row.project}:${row.id}`,
    id: row.id,
    kind: row.kind,
    project: row.project || "",
    path: row.path,
    title: row.title || "",
    // WHICH ARC THIS DOCUMENT IS PLANNED INTO — the leaf's own address (`arc=ARC-001-O6`),
    // carried, not parsed: `parseAddress` owns what an address is and reads it where it is
    // needed. It is what lets a held arc narrow the RFC track to the plans that serve it.
    arc: String(row.arc || ""),
    station: stateOf(row.kind, row),
    at: Number(row.at) || 0,
    stale: !!row.stale,
    missing: !!row.missing,
    ratio: p.ratio,
    says: p.says,
    warn: p.warn,
    drains: !!p.drains,
    unread: !!p.unread,
    // WHAT KIND OF REPORT — `as=` on the leaf (planning, notice, audit, account, brief, spec). It
    // decides the retention the clock runs on, so a card that does not say it is showing a clock
    // without saying what set it. His: *"you should put what kind of report it is, it should be
    // visible."*
    subtype: String((row.state || {}).subtype || ""),
    // HAS HE OPENED IT. `openedAt` is the only field that answers this, and the near-miss is the
    // reason to say so: `retainLine` reports `counting: false` for a PERMANENT report AND for one
    // never opened, so reading "seen" off the clock calls every permanent report unopened forever.
    // His catch: *"why do they say unopened when I know I've seen them? Because they're permanent
    // — that's probably why you're saying they're unopened."* Exactly that.
    //
    // The clock still does not start until first open (RFC-076 §4.6); that is WHY an unopened
    // report draws a full ring, and why the card has to say which kind of full it is.
    seen: !!row.openedAt,
    // ⚑ MEANS "A DECISION IS WAITING ON YOU" and ⧗ MEANS A DEADLINE — the band's own rule, which
    // exists because sharing one mark made it unreadable ("I don't know what the other one is").
    // A bead carries the mark of the loudest thing it owes and nothing else; a bead with two marks
    // is a bead nobody reads.
    mark: press.some((o) => o.why === "clock") ? "⧗" : press.length ? "⚑" : "",
    press: press.length,
    work: work.length,
    owes: first ? first.says : "",
    line: first ? first.line : typeof text === "string" ? leafLine(text) : 1,
  };
}

// Inside a station, the one closest to leaving it leads — it is the cheapest to move. A bead with
// something owed jumps the queue, because the page is a place to act.
const byUrgency = (a, b) =>
  (b.press > 0) - (a.press > 0) ||
  (b.work > 0) - (a.work > 0) ||
  (b.ratio == null ? -1 : 0) - (a.ratio == null ? -1 : 0) ||
  (b.ratio || 0) - (a.ratio || 0) ||
  String(a.id).localeCompare(String(b.id), undefined, { numeric: true });

/**
 * One kind's track: its stations in trail order, each holding the documents standing there.
 *
 * AN EMPTY STATION IS DRAWN. That is the whole value of the picture — the gap between a full
 * `draft` column and an empty `settled` one is the sentence "nothing is finishing", and dropping
 * the empty column deletes it.
 */
export function trackFor(kind, beads = []) {
  const mine = beads.filter((b) => b.kind === kind);
  const stations = stationsFor(kind).map((station) => ({
    station,
    beads: mine.filter((b) => b.station === station).sort(byUrgency),
  }));
  // A STATION THE TRAIL DOES NOT KNOW STILL DRAWS. `rejected` is on the gap trail but not the
  // rfc/arc one that `stateOf` can return, and a rejected RFC vanishing off the track would be the
  // page quietly losing a document — the one state somebody is most likely to reopen by accident.
  const known = new Set(stationsFor(kind));
  const strays = [...new Set(mine.filter((b) => !known.has(b.station)).map((b) => b.station))];
  strays.forEach((station) => stations.push({ station, beads: mine.filter((b) => b.station === station).sort(byUrgency) }));
  return {
    kind,
    stations,
    total: mine.length,
    press: mine.reduce((n, b) => n + b.press, 0),
    work: mine.reduce((n, b) => n + b.work, 0),
  };
}

// ─── THE REPORT STACKS ─────────────────────────────────────────────────────────────────────────
//
// His one visual cue, verbatim: *"reports looking like a stack with numbers, and then you click them
// and they expand out horizontally."* It lands on reports and not on the other kinds because it is
// TRUE of reports: a report is a view with a lifecycle of days, they arrive in a pile, and the pile
// drains. One stack per project, because "all the projects going on at the same time" is the other
// half of the ask and a single global pile would bury the project that is actually producing.
export function reportStacks(beads = []) {
  const mine = beads.filter((b) => b.kind === "report");
  const byProject = new Map();
  mine.forEach((b) => byProject.set(b.project, [...(byProject.get(b.project) || []), b]));
  return [...byProject.entries()]
    .map(([project, cards]) => ({
      project,
      n: cards.length,
      // URGENT IS THE ONLY THING THAT REORDERS A STACK. Waiting is the only thing on this page that
      // DESTROYS something, so the pile that is about to lose a report stands in front.
      urgent: cards.filter((c) => c.mark === "⧗").length,
      // UNSEEN, counted on the face, because a closed stack shows no cards at all — the fact would
      // otherwise be one he can only reach by opening every pile.
      unseen: cards.filter((c) => !c.seen && c.station !== "retired").length,
      cards: cards.sort(
        (a, b) =>
          (b.mark === "⧗") - (a.mark === "⧗") ||
          // soonest to go first among counting clocks, then the freshest arrivals
          (a.ratio == null ? 1 : 0) - (b.ratio == null ? 1 : 0) ||
          (a.ratio || 0) - (b.ratio || 0) ||
          b.at - a.at,
      ),
    }))
    .sort((a, b) => b.urgent - a.urgent || b.n - a.n || String(a.project).localeCompare(String(b.project)));
}

// ─── THE TIDE ──────────────────────────────────────────────────────────────────────────────────
//
// ONE BAR, EVERY DOCUMENT, FOUR BANDS — the shape of the whole system in one glance, before any
// reading happens. The bands are not states, they are POSTURES toward him, which is the only
// cross-kind axis that exists: a report's clock and an RFC's unsigned approval are nothing alike as
// states and identical as obligations.
export const TIDE = [
  { key: "press", label: "waiting on you" },
  { key: "work", label: "outstanding" },
  { key: "clear", label: "clear" },
  { key: "parked", label: "retired" },
];

// `station === "retired"` IS THE TEST FOR EVERY KIND, not a per-kind guess: `stateOf` answers
// retired before it looks at the kind at all, so one comparison covers an RFC, an arc, a gap and a
// report. Reading `state.retired` off the row again here would be a second reader of one subject.
export function tideOf(beads = []) {
  const seg = { press: 0, work: 0, clear: 0, parked: 0 };
  beads.forEach((b) => {
    if (b.station === "retired") seg.parked += 1;
    else if (b.press) seg.press += 1;
    else if (b.work) seg.work += 1;
    else seg.clear += 1;
  });
  const total = beads.length;
  return TIDE.map((t) => ({ ...t, n: seg[t.key], pct: total ? (seg[t.key] / total) * 100 : 0 }));
}

// ─── THE PROJECTS ──────────────────────────────────────────────────────────────────────────────

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * One line per project — EVERY project the hub knows, not only the ones with documents.
 *
 * A PROJECT WITH NOTHING REGISTERED IS A FACT, NOT AN ABSENCE. `projectRoots()` is the widest list
 * there is (folder-only projects included), and a dashboard that silently drew only the projects
 * carrying documents would answer "what is going on everywhere" with "everywhere I found
 * something" — which on this machine today is one project out of twelve. So they are listed, and
 * `quiet` is what lets the page fold them into one honest sentence instead of eleven empty cards.
 */
export function projectLines(projects = {}, beads = [], now = Date.now()) {
  const codes = [...new Set([...Object.keys(projects || {}), ...beads.map((b) => b.project)])].filter(Boolean);
  return codes
    .map((code) => {
      const mine = beads.filter((b) => b.project === code);
      const counts = {};
      KINDS.forEach(({ kind }) => (counts[kind] = mine.filter((b) => b.kind === kind).length));
      const lastAt = mine.reduce((m, b) => Math.max(m, b.at), 0);
      return {
        code,
        root: (projects || {})[code] || "",
        n: mine.length,
        counts,
        press: mine.reduce((n, b) => n + b.press, 0),
        work: mine.reduce((n, b) => n + b.work, 0),
        stale: mine.filter((b) => b.stale).length,
        lastAt,
        // "last read 3 days ago" — the registry's `at` is when the shell last PARSED the document,
        // which is the closest thing the system has to "is anything happening here". Said as the
        // parse it is, never as "last changed", because a quiet repo and an unwatched one look the
        // same from here and only one of them is fine.
        lastWords: lastAt ? `${spanWords(Math.max(1000, now - lastAt))} ago` : "",
        quiet: mine.length === 0,
      };
    })
    .sort(
      (a, b) =>
        b.press - a.press ||
        b.work - a.work ||
        b.n - a.n ||
        b.lastAt - a.lastAt ||
        String(a.code).localeCompare(String(b.code)),
    );
}

// ─── THE HEAD ──────────────────────────────────────────────────────────────────────────────────

/**
 * THE ONE SENTENCE, and it is about him. Not "28 documents" — that is inventory, and he threw
 * inventory out. The order is what he would reach for first: a press, then work nobody can press
 * away, then how much of the system that count actually covers.
 *
 * `nothing owed` is said OUT LOUD when it is true and we really read everything, because that zero
 * is the answer he has never been able to get. And a zero over nothing read says NOTHING, because
 * an empty state that reads as "nothing to do" when it means "nothing was read" is the lie this
 * whole system exists to stop.
 */
/**
 * WHY A LIST IS EMPTY, which is three different facts wearing one blank space and the page may
 * never blur them: nothing is owed (a real, earned zero), nothing is REGISTERED (the registry is
 * empty — true today in eleven of twelve projects on this machine), or nothing could be READ (rows
 * exist and the files behind them did not open). One helper, used by the head and by every column,
 * so the three cannot drift into each other surface by surface.
 */
export function emptyWords({ total = 0, counted = 0 } = {}, clear = "nothing owed", brief = false) {
  if (counted) return clear;
  if (!total) return brief ? "nothing is registered yet" : "nothing is registered in any project — the registry is empty";
  return brief ? "nothing could be read — an unmeasured list, not an empty one" : "nothing could be read — this is not a zero";
}

export function headOf({ owed = {}, beads = [], projects = [], total = 0 } = {}) {
  const press = (owed.press || []).reduce((n, p) => n + (p.n || 1), 0);
  const work = (owed.work || []).length;
  const live = projects.filter((p) => !p.quiet).length;
  const needy = projects.filter((p) => p.press || p.work).length;
  const segs = [];
  if (press) segs.push({ key: "press", mark: "⚑", text: `${press} ${press === 1 ? "press" : "presses"} waiting on you` });
  if (work) segs.push({ key: "work", mark: "", text: `${work} outstanding` });
  if (!segs.length)
    segs.push({
      key: owed.counted ? "clear" : total ? "unreadable" : "unregistered",
      mark: "",
      text: emptyWords({ total, counted: owed.counted }),
    });
  return {
    segs,
    // "across 3 of 12 projects" — the denominator is the point. A count over one project out of
    // twelve is not a picture of the system and the head has to say which it is.
    reach: projects.length
      ? `${plural(beads.length, "document")} across ${live} of ${plural(projects.length, "project")}${
          needy ? ` · ${needy} ${needy === 1 ? "needs" : "need"} you` : ""
        }`
      : "",
    skipped: skippedLine(owed.skipped || {}),
  };
}

// ─── THE WHOLE FLOOR ───────────────────────────────────────────────────────────────────────────

/**
 * Everything the page draws, from the registry rows, the documents' own text, and the hub's list of
 * projects. One call, so the component holds no derivation and the page is provable without React.
 *
 * @param docs `[{ row, text }]` — every registry row, and the document's source. `text` absent
 *   means the file could not be read, which is CARRIED rather than swallowed: a count over eleven
 *   of thirteen documents is not a count.
 * @param projects `{ [code]: absoluteRoot }` from `SystemView.projectRoots()` — the widest list.
 */
export function floorFrom({ docs = [], projects = {}, now = Date.now() } = {}) {
  const all = (docs || []).filter((d) => d && d.row && d.row.id && d.row.path);
  // A FIXTURE IS NOT WORK, and the same two signals `owed.js` uses decide it here — one rule, one
  // place, so the tide and the tracks cannot count a document the obligations list excluded.
  const real = all.filter((d) => !isFixture(d.row));
  const fixtures = all.length - real.length;

  // THE OBLIGATIONS COME FROM `owed.js`, OVER EVERY PROJECT AT ONCE. One call rather than one per
  // project, deliberately: an arc's objectives are planned by documents that can live in another
  // repo entirely (`arc=ARC-001-O6` on the plan's own leaf), and `plansByObjective` resolves those
  // by address, not by project. Splitting the call by project would report cross-repo plans as
  // unplanned objectives — work he does not owe.
  const owed = owedFrom({ docs: all, now });
  const owedByDoc = {};
  [...(owed.press || []), ...(owed.work || [])].forEach((o) => {
    (owedByDoc[docKey(o)] = owedByDoc[docKey(o)] || []).push(o);
  });

  const beads = real.map((d) => beadFor(d, owedByDoc, now));
  const lines = projectLines(projects, beads, now);
  return {
    head: headOf({ owed, beads, projects: lines, total: all.length }),
    owed,
    // WHAT WAS THERE AND WHAT WAS READ, carried so every empty space on the page can say which of
    // the three nothings it is rather than leaving the reader to assume the flattering one.
    measured: { total: all.length, counted: owed.counted || 0 },
    fixtures,
    tide: tideOf(beads),
    tracks: TRACK_KINDS.map((kind) => trackFor(kind, beads)),
    stacks: reportStacks(beads),
    projects: lines,
    beads,
    now,
  };
}

export default floorFrom;
